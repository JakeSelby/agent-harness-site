#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AgentHarnessSiteStack } from '../lib/agent-harness-site-stack.js';

const app = new cdk.App();

new AgentHarnessSiteStack(app, 'AgentHarnessSite', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT ?? '123456789012',
    region: 'us-east-1',
  },
  description: 'agent-harness.jakeselby.com reference site — S3 + CloudFront + ACM + Route53',
  tags: {
    Project: 'agent-harness-site',
    ManagedBy: 'cdk',
  },
});
