import assert from 'node:assert/strict';
import test from 'node:test';
import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { readInfraConfig } from './config.js';
import { AgentHarnessSiteStack } from './agent-harness-site-stack.js';

const env = {
  SITE_AWS_ACCOUNT_ID: '123456789012',
  SITE_HOSTED_ZONE_ID: 'Z123EXAMPLE',
  SITE_BUCKET_NAME: 'example-harness-site',
  SITE_ROUTING_FUNCTION_NAME: 'example-site-routing',
  SITE_DEPLOY_ROLE_NAME: 'ExampleSiteDeployRole',
};

test('creates the model-citizen.dev hosted zone and outputs its name servers', () => {
  const app = new cdk.App();
  const config = readInfraConfig(env);
  const stack = new AgentHarnessSiteStack(app, 'AgentHarnessSite', {
    config,
    env: { account: config.accountId, region: 'us-east-1' },
  });
  const template = Template.fromStack(stack);
  template.resourceCountIs('AWS::Route53::HostedZone', 1);
  template.hasResourceProperties('AWS::Route53::HostedZone', { Name: 'model-citizen.dev.' });
  const zones = Object.keys(template.findResources('AWS::Route53::HostedZone'));
  assert.ok(zones[0].startsWith('ModelCitizenZone'));
  template.hasOutput('ModelCitizenNameServers', {
    Value: { 'Fn::Join': [',', { 'Fn::GetAtt': [zones[0], 'NameServers'] }] },
  });
});
