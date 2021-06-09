import * as cdk from "@aws-cdk/core";
import * as s3 from '@aws-cdk/aws-s3';
import * as lambda from '@aws-cdk/aws-lambda';
import * as events from '@aws-cdk/aws-lambda-event-sources';
import * as sns from '@aws-cdk/aws-sns';
import { calculateSha256 } from "./tools";

export interface ObservableBucketProps {
  prefix?: string,
  lambdaLogLevel?: 'DEBUG' | 'INFO' | 'ERROR'
}

export class ObservableBucket extends cdk.Construct {

  public readonly imageUploadedTopic: sns.ITopic;
  public readonly imageUploadBucket: s3.IBucket;

  constructor(scope: cdk.Construct, id: string, props: ObservableBucketProps = {}) {
    super(scope, id);

    props.prefix = props.prefix ?? 'images/';
    props.lambdaLogLevel = props.lambdaLogLevel ?? 'INFO';

    const bucket = new s3.Bucket(this, 'imageBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: true
    });
    this.imageUploadBucket = bucket;
    
    const powertoolsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this, 'powertoolsLayer', cdk.Fn.importValue('LayerVersionArn-serverlessrepo-aws-lambda-powertools-python-layer')
    );
    
    const imageUploadedTopic = new sns.Topic(this, 'imageUploadedTopic');
    this.imageUploadedTopic = imageUploadedTopic;

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
        LOG_LEVEL: props.lambdaLogLevel || 'INFO',
        POWERTOOLS_SERVICE_NAME: 'image-upload'
      },
      currentVersionOptions: {
        codeSha256: calculateSha256(imageUploadedCodePath)
      }
    });

    imageUploadedTopic.grantPublish(imageUploadedLambda);

    ['.jpg', '.png'].forEach((suffix: string) => {
      imageUploadedLambda.addEventSource(new events.S3EventSource(bucket, {
        events: [s3.EventType.OBJECT_CREATED],
        filters: [{prefix: props.prefix, suffix: suffix}]
      }));
    });

  }
}

