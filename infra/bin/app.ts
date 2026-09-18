#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { readInfraConfig } from '../lib/config.js';
import { AgentHarnessSiteStack } from '../lib/agent-harness-site-stack.js';

const envFile = fileURLToPath(new URL('../../.env.infra', import.meta.url));
if (existsSync(envFile)) loadEnvFile(envFile);
const config = readInfraConfig(process.env);

const app = new cdk.App();

new AgentHarnessSiteStack(app, 'AgentHarnessSite', {
  config,
  env: {
    account: config.accountId,
    region: 'us-east-1',
  },
  description: 'agent-harness.jakeselby.com reference site — S3 + CloudFront + ACM + Route53',
  tags: {
    Project: 'agent-harness-site',
    ManagedBy: 'cdk',
  },
});
