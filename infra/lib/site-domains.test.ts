import assert from 'node:assert/strict';
import test from 'node:test';
import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { readInfraConfig } from './config.js';
import { AgentHarnessSiteStack } from './agent-harness-site-stack.js';
import { ROUTING_FUNCTION_CODE } from './routing-function.js';

const env = {
  SITE_AWS_ACCOUNT_ID: '123456789012',
  SITE_HOSTED_ZONE_ID: 'Z123EXAMPLE',
  SITE_BUCKET_NAME: 'example-harness-site',
  SITE_ROUTING_FUNCTION_NAME: 'example-site-routing',
  SITE_DEPLOY_ROLE_NAME: 'ExampleSiteDeployRole',
};

const synth = () => {
  const app = new cdk.App();
  const config = readInfraConfig(env);
  const stack = new AgentHarnessSiteStack(app, 'AgentHarnessSite', {
    config,
    env: { account: config.accountId, region: 'us-east-1' },
  });
  return Template.fromStack(stack);
};

const zoneRef = (template: Template) => {
  const [id] = Object.keys(template.findResources('AWS::Route53::HostedZone'));
  return { Ref: id };
};

test('the certificate covers the apex, www and the old host, each validated in its own zone', () => {
  const template = synth();
  template.hasResourceProperties('AWS::CertificateManager::Certificate', {
    DomainName: 'model-citizen.dev',
    SubjectAlternativeNames: ['www.model-citizen.dev', 'agent-harness.jakeselby.com'],
    ValidationMethod: 'DNS',
    DomainValidationOptions: [
      { DomainName: 'model-citizen.dev', HostedZoneId: zoneRef(template) },
      { DomainName: 'www.model-citizen.dev', HostedZoneId: zoneRef(template) },
      { DomainName: 'agent-harness.jakeselby.com', HostedZoneId: env.SITE_HOSTED_ZONE_ID },
    ],
  });
});

test('the distribution answers on the new names and keeps the old one', () => {
  synth().hasResourceProperties('AWS::CloudFront::Distribution', {
    DistributionConfig: Match.objectLike({
      Aliases: ['model-citizen.dev', 'www.model-citizen.dev', 'agent-harness.jakeselby.com'],
    }),
  });
});

test('the viewer-request function is the tested redirect and rewrite source', () => {
  synth().hasResourceProperties('AWS::CloudFront::Function', {
    FunctionCode: ROUTING_FUNCTION_CODE,
    FunctionConfig: Match.objectLike({ Runtime: 'cloudfront-js-2.0' }),
  });
});

test('the apex and www carry A and AAAA aliases in the new zone', () => {
  const template = synth();
  for (const name of ['model-citizen.dev.', 'www.model-citizen.dev.']) {
    for (const type of ['A', 'AAAA']) {
      template.hasResourceProperties('AWS::Route53::RecordSet', {
        Name: name,
        Type: type,
        HostedZoneId: zoneRef(template),
        AliasTarget: Match.objectLike({ HostedZoneId: Match.anyValue() }),
      });
    }
  }
});

test('the old host keeps its A alias, logical ID and zone', () => {
  const template = synth();
  const records = template.findResources('AWS::Route53::RecordSet', {
    Properties: { Name: 'agent-harness.jakeselby.com.', Type: 'A', HostedZoneId: env.SITE_HOSTED_ZONE_ID },
  });
  const ids = Object.keys(records);
  assert.equal(ids.length, 1);
  assert.ok(ids[0].startsWith('AliasRecord'));
  template.resourceCountIs('AWS::Route53::RecordSet', 5);
});

test('the site URL output names the apex', () => {
  synth().hasOutput('SiteUrl', { Value: 'https://model-citizen.dev' });
});
