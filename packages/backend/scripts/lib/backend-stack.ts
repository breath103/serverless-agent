import path from "node:path";

import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

const ROOT = path.resolve(import.meta.dirname, "../..");

interface BackendStackId {
  project: string;
}

interface BackendStackProps extends cdk.StackProps {
  project: string;
  envVars: Record<string, string>;
  mqttBrokerUrl: string;
}

export class BackendStack extends cdk.Stack {
  static id({ project }: BackendStackId): string {
    return `${project}-backend`;
  }

  static functionName({ project }: BackendStackId): string {
    return `${project}-backend-handler`;
  }

  constructor(scope: Construct, props: BackendStackProps) {
    const id = BackendStack.id({ project: props.project });
    super(scope, id, props);

    const functionName = BackendStack.functionName({ project: props.project });
    const distCode = lambda.Code.fromAsset(path.join(ROOT, "dist"));

    // ── DynamoDB Tables ───────────────────────────────────────────────
    //
    // Each domain entity has its own table. Pay-per-request keeps the demo
    // free when idle. Ownership-scoped tables (memories, entities, etc.)
    // use (userId, id) — PK+SK — so a single Query returns everything for
    // the current user without scans.
    const tableDefaults = {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecovery: true,
    } as const;

    // users: id → { username, password_hash, name, created_at }
    const usersTable = new dynamodb.Table(this, "UsersTable", {
      ...tableDefaults,
      tableName: `${id}-users`,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
    });
    usersTable.addGlobalSecondaryIndex({
      indexName: "by-username",
      partitionKey: { name: "username", type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // sessions: id → { user_id, expires_at }
    // TTL on expires_at_epoch (unix seconds) auto-purges expired sessions.
    const sessionsTable = new dynamodb.Table(this, "SessionsTable", {
      ...tableDefaults,
      tableName: `${id}-sessions`,
      partitionKey: { name: "id", type: dynamodb.AttributeType.STRING },
      timeToLiveAttribute: "expires_at_epoch",
    });

    // profiles: user_id → profile
    const profilesTable = new dynamodb.Table(this, "ProfilesTable", {
      ...tableDefaults,
      tableName: `${id}-profiles`,
      partitionKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
    });

    // memories: (user_id, id) → memory row
    const memoriesTable = new dynamodb.Table(this, "MemoriesTable", {
      ...tableDefaults,
      tableName: `${id}-memories`,
      partitionKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "id", type: dynamodb.AttributeType.STRING },
    });

    // chat_sessions: (user_id, id) → session row
    const chatSessionsTable = new dynamodb.Table(this, "ChatSessionsTable", {
      ...tableDefaults,
      tableName: `${id}-chat-sessions`,
      partitionKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "id", type: dynamodb.AttributeType.STRING },
    });

    // chat_session_messages: (session_id, created_at_id) → message row
    // created_at_id = `${created_at}#${id}` so the natural SK order is chronological.
    const chatMessagesTable = new dynamodb.Table(this, "ChatMessagesTable", {
      ...tableDefaults,
      tableName: `${id}-chat-messages`,
      partitionKey: { name: "session_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "created_at_id", type: dynamodb.AttributeType.STRING },
    });

    // user_skills: (user_id, id) → installed-skill row (OAuth tokens + config)
    const userSkillsTable = new dynamodb.Table(this, "UserSkillsTable", {
      ...tableDefaults,
      tableName: `${id}-user-skills`,
      partitionKey: { name: "user_id", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "id", type: dynamodb.AttributeType.STRING },
    });

    const allTables = [
      usersTable,
      sessionsTable,
      profilesTable,
      memoriesTable,
      chatSessionsTable,
      chatMessagesTable,
      userSkillsTable,
    ];

    // ── S3 Bucket for Agent State ─────────────────────────────────────
    const agentBucket = new s3.Bucket(this, "AgentStorageBucket", {
      bucketName: `${id}-agents`,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      transferAcceleration: true,
      blockPublicAccess: new s3.BlockPublicAccess({
        blockPublicAcls: true,
        ignorePublicAcls: true,
        blockPublicPolicy: false,
        restrictPublicBuckets: false,
      }),
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.PUT],
        allowedOrigins: ["*"],
        allowedHeaders: ["*"],
      }],
    });

    agentBucket.addToResourcePolicy(new iam.PolicyStatement({
      sid: "PublicReadUserFiles",
      effect: iam.Effect.ALLOW,
      principals: [new iam.AnyPrincipal()],
      actions: ["s3:GetObject"],
      resources: [agentBucket.arnForObjects("users/*")],
    }));

    const sharedEnv = {
      NODE_ENV: "production",
      ...props.envVars,
      // Each repo derives `${prefix}-<entity>`; `id` already equals
      // `${project}-backend`, matching the table names declared above.
      TABLE_NAME_PREFIX: id,
      AGENT_STORAGE_BUCKET: agentBucket.bucketName,
    };

    // ── API Lambda (HTTP handler) ─────────────────────────────────────
    const fn = new lambda.Function(this, "Handler", {
      functionName,
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: "lambda-api/handler.handler",
      code: distCode,
      memorySize: 1769,
      timeout: cdk.Duration.seconds(30),
      logGroup: new logs.LogGroup(this, "HandlerLogGroup", {
        logGroupName: `/aws/lambda/${functionName}`,
        retention: logs.RetentionDays.TWO_MONTHS,
      }),
      environment: sharedEnv,
    });

    const fnAlias = new lambda.Alias(this, "HandlerAlias", {
      aliasName: "live",
      version: fn.currentVersion,
    });

    agentBucket.grantReadWrite(fn);
    allTables.forEach((t) => t.grantReadWriteData(fn));
    fn.addToRolePolicy(new iam.PolicyStatement({
      actions: ["iot:Publish"],
      resources: ["*"],
    }));

    const fnUrl = fnAlias.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

    // ── MQTT Role ─────────────────────────────────────────────────────
    const agentMqttRole = new iam.Role(this, "AgentMqttRole", {
      roleName: `${id}-agent-mqtt`,
      assumedBy: new iam.ArnPrincipal(fn.role!.roleArn),
      inlinePolicies: {
        iot: new iam.PolicyDocument({
          statements: [new iam.PolicyStatement({
            actions: ["iot:Connect", "iot:Publish", "iot:Subscribe", "iot:Receive"],
            resources: ["*"],
          })],
        }),
      },
    });

    fn.addEnvironment("AGENT_MQTT_BROKER_URL", props.mqttBrokerUrl);
    fn.addEnvironment("AGENT_MQTT_ROLE_ARN", agentMqttRole.roleArn);
    agentMqttRole.grantAssumeRole(fn.role!);

    // ── Prewarm Lambdas ───────────────────────────────────────────────
    new events.Rule(this, "WarmerSchedule", {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [
        new targets.LambdaFunction(fn, {
          event: events.RuleTargetInput.fromObject({ source: "warmer" }),
        }),
      ],
    });

    // ── Outputs ───────────────────────────────────────────────────────
    new cdk.CfnOutput(this, "FunctionUrl", { value: fnUrl.url });
  }
}
