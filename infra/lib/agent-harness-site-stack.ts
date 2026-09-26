import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import type { InfraConfig } from './config.js';
import { CANONICAL_HOST, ROUTING_FUNCTION_CODE } from './routing-function.js';

export interface AgentHarnessSiteStackProps extends cdk.StackProps {
  config: InfraConfig;
}

const DOMAIN = CANONICAL_HOST;
const WWW = `www.${DOMAIN}`;
// The site's first home. It keeps its certificate name and record and answers with a 301.
const LEGACY_DOMAIN = 'agent-harness.jakeselby.com';
const REPO = 'JakeSelby/agent-harness-site';
// The repository is renamed to model-citizen-site. GitHub names the repository in the token's
// subject, so the deploy role trusts both names until nothing runs under the old one.
const REPO_NAMES = ['JakeSelby/model-citizen-site', REPO];

/**
 * model-citizen.dev: the public reference site for Model Citizen, formerly agent-harness.
 *
 * Same shape as the other jakeselby.com surfaces:
 *   - ACM cert for the apex, www and the old agent-harness.jakeselby.com host, DNS-validated
 *     against the model-citizen.dev and jakeselby.com zones (us-east-1, for CloudFront)
 *   - Private S3 bucket behind origin access control, versioned, retained on delete
 *   - CloudFront with a viewer-request function that 301s every other host to the apex and
 *     rewrites clean URLs to index.html
 *   - Route53 A and AAAA aliases for the apex and www; the old host keeps its A alias
 *   - A GitHub Actions deploy role (OIDC) that can only sync the bucket and invalidate
 *
 * Prerequisites: the configured hosted zone and the account's GitHub OIDC provider
 * both exist. See .env.infra.example for deployment configuration.
 */
export class AgentHarnessSiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AgentHarnessSiteStackProps) {
    super(scope, id, props);
    const { config } = props;

    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: config.hostedZoneId,
      zoneName: 'jakeselby.com',
    });

    // model-citizen.dev is registered elsewhere and delegated to this zone at the registrar.
    const modelCitizenZone = new route53.PublicHostedZone(this, 'ModelCitizenZone', {
      zoneName: DOMAIN,
    });

    const cert = new acm.Certificate(this, 'Cert', {
      domainName: DOMAIN,
      subjectAlternativeNames: [WWW, LEGACY_DOMAIN],
      validation: acm.CertificateValidation.fromDnsMultiZone({
        [DOMAIN]: modelCitizenZone,
        [WWW]: modelCitizenZone,
        [LEGACY_DOMAIN]: hostedZone,
      }),
    });

    // Versioned so a bad `s3 sync --delete` is recoverable; old versions expire after 30 days.
    const bucket = new s3.Bucket(this, 'WebBucket', {
      bucketName: config.bucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [{ noncurrentVersionExpiration: cdk.Duration.days(30) }],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      autoDeleteObjects: false,
    });

    // Host redirect and clean-URL rewrite in one function; see routing-function.ts.
    const routingFunction = new cloudfront.Function(this, 'RoutingFunction', {
      functionName: config.routingFunctionName,
      code: cloudfront.FunctionCode.fromInline(ROUTING_FUNCTION_CODE),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      domainNames: [DOMAIN, WWW, LEGACY_DOMAIN],
      certificate: cert,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        compress: true,
        functionAssociations: [
          { function: routingFunction, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST },
        ],
      },
      additionalBehaviors: {
        '_astro/*': {
          origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: new cloudfront.CachePolicy(this, 'AssetsCachePolicy', {
            defaultTtl: cdk.Duration.days(365),
            maxTtl: cdk.Duration.days(365),
            minTtl: cdk.Duration.days(365),
            enableAcceptEncodingGzip: true,
            enableAcceptEncodingBrotli: true,
          }),
          compress: true,
        },
      },
      // The site ships src/pages/404.astro, so both S3's 403-for-missing-key and a real
      // 404 land on a page that exists.
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 404, responsePagePath: '/404.html', ttl: cdk.Duration.seconds(0) },
        { httpStatus: 404, responseHttpStatus: 404, responsePagePath: '/404.html', ttl: cdk.Duration.seconds(0) },
      ],
    });

    const siteTarget = route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution));
    // The old host's record keeps its logical ID so the deploy updates nothing about it.
    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      recordName: LEGACY_DOMAIN,
      target: siteTarget,
      comment: `${LEGACY_DOMAIN} → CloudFront (agent-harness reference site)`,
    });
    for (const [id, recordName] of [['Apex', DOMAIN], ['Www', WWW]] as const) {
      new route53.ARecord(this, `${id}AliasRecord`, { zone: modelCitizenZone, recordName, target: siteTarget });
      new route53.AaaaRecord(this, `${id}AliasRecordIpv6`, { zone: modelCitizenZone, recordName, target: siteTarget });
    }

    // ── CI deploy role (GitHub Actions, OIDC) ────────────────────────────────
    // Trusts only this repository's main branch and can do only what
    // scripts/deploy-site.sh does: write the bucket, invalidate the distribution,
    // read this stack's outputs. Infrastructure changes stay a `cdk deploy` from the Mac.
    const githubProvider = iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
      this,
      'GitHubOidc',
      `arn:aws:iam::${this.account}:oidc-provider/token.actions.githubusercontent.com`,
    );
    const deployRole = new iam.Role(this, 'DeployRole', {
      roleName: config.deployRoleName,
      description: `GitHub Actions in ${REPO} (main): sync the site, invalidate CloudFront`,
      assumedBy: new iam.WebIdentityPrincipal(githubProvider.openIdConnectProviderArn, {
        StringEquals: { 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com' },
        // GitHub issues the subject in two shapes — the plain owner/repo form and
        // the newer owner@id/repo@id form — so both are accepted, as the other
        // deploy roles in this account do.
        StringLike: {
          'token.actions.githubusercontent.com:sub': REPO_NAMES.flatMap((name) => [
            `repo:${name}:ref:refs/heads/main`,
            `repo:${name.replace('/', '@*/')}@*:ref:refs/heads/main`,
          ]),
        },
      }),
      maxSessionDuration: cdk.Duration.hours(1),
    });
    bucket.grantReadWrite(deployRole);
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudfront:CreateInvalidation'],
        resources: [`arn:aws:cloudfront::${this.account}:distribution/${distribution.distributionId}`],
      }),
    );
    deployRole.addToPolicy(
      new iam.PolicyStatement({ actions: ['cloudformation:DescribeStacks'], resources: [this.stackId] }),
    );

    // ── Outputs (deploy.sh and deploy.yml read these back) ───────────────────
    new cdk.CfnOutput(this, 'DeployRoleArn', {
      value: deployRole.roleArn,
      description: 'Set as the AWS_DEPLOY_ROLE_ARN repository variable in GitHub',
    });
    new cdk.CfnOutput(this, 'BucketName', {
      value: bucket.bucketName,
      description: 'S3 bucket — deploy: aws s3 sync dist/ s3://<bucket>',
    });
    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      description: 'CloudFront distribution ID — used for cache invalidation',
    });
    new cdk.CfnOutput(this, 'DistributionDomain', {
      value: distribution.distributionDomainName,
      description: 'CloudFront domain for smoke-testing before DNS propagates',
    });
    new cdk.CfnOutput(this, 'SiteUrl', { value: `https://${DOMAIN}` });
    new cdk.CfnOutput(this, 'ModelCitizenNameServers', {
      value: cdk.Fn.join(',', modelCitizenZone.hostedZoneNameServers!),
      description: 'Name servers to enter at the model-citizen.dev registrar',
    });
  }
}
