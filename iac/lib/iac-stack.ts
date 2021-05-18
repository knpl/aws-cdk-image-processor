import * as cdk from '@aws-cdk/core';
import * as s3 from '@aws-cdk/aws-s3';
import * as lambda from '@aws-cdk/aws-lambda';
import * as events from '@aws-cdk/aws-lambda-event-sources';
import * as sns from '@aws-cdk/aws-sns';
import * as fs from 'fs';
import sha256 from 'fast-sha256';

export class IacStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'imageBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true
    });

    const imageUploadedTopic = new sns.Topic(this, 'imageUploadedTopic');

    const powertoolsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this, 'powertoolsLayer', cdk.Fn.importValue('LayerVersionArn-serverlessrepo-aws-lambda-powertools-python-layer')
    );

    const imageUploadedCodePath = './assets/s3-image-upload-lambda/dist/package.zip';
    const imageUploadedLambda = new lambda.Function(this, 'S3ImageUploadLambda', {
      runtime: lambda.Runtime.PYTHON_3_8,
      code: lambda.Code.fromAsset(imageUploadedCodePath),
      handler: 'handler.lambda_handler',
      tracing: lambda.Tracing.ACTIVE,
      layers: [powertoolsLayer],
      timeout: cdk.Duration.seconds(3),
      memorySize: 128,
      environment: {
        SNS_TOPIC_ARN: imageUploadedTopic.topicArn,
        LOG_LEVEL: "INFO",
        POWERTOOLS_SERVICE_NAME: "image-upload"
      },
      currentVersionOptions: {
        codeSha256: this.calculateSha256(imageUploadedCodePath)
      }
    });

    imageUploadedTopic.grantPublish(imageUploadedLambda);

    ['.jpg', '.png'].forEach((suffix: string) => {
      const eventSource = new events.S3EventSource(bucket, {
        events: [s3.EventType.OBJECT_CREATED],
        filters: [
          {prefix: 'images/', suffix: suffix},
        ]
      });
      eventSource.bind(imageUploadedLambda);
    });
  }

  private calculateSha256(path: string): string {
    const buffer: Buffer = fs.readFileSync(path, {flag: 'r'})
    return this.toHexString(sha256(buffer));
  }

  private toHexString(byteArray: Uint8Array): string {
    const strBytes: string[] = [];
    byteArray.forEach(byte => {
       strBytes.push(('0' + (byte & 0xFF).toString(16)).slice(-2));
    });
    return strBytes.join("");
  }
}
