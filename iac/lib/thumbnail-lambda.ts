import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as events from '@aws-cdk/aws-lambda-event-sources';
import {IBucket} from '@aws-cdk/aws-s3';
import {ITopic} from '@aws-cdk/aws-sns';
import {calculateSha256} from './tools';


export interface ThumbnailLambdaProps {
  imageUploadedTopic: ITopic
  destinationBucket: IBucket
  destinationPrefix: string
  thumbnailWidth?: number
  thumbnailHeight?: number
  lambdaLogLevel?: 'DEBUG' | 'INFO' | 'ERROR'
}

export class ThumbnailLambda extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: ThumbnailLambdaProps) {
    super(scope, id);

    props.thumbnailWidth = props.thumbnailWidth ?? 128;
    props.thumbnailHeight = props.thumbnailHeight ?? 128;
    props.lambdaLogLevel = props.lambdaLogLevel ?? 'INFO';

    const powertoolsLayer = lambda.LayerVersion.fromLayerVersionArn(
      this, 'powertoolsLayer', cdk.Fn.importValue('LayerVersionArn-serverlessrepo-aws-lambda-powertools-python-layer')
    );
    const thumbnailLambdaCodePath = './assets/thumbnail_lambda/dist/package.zip';
    const thumbnailLambda = new lambda.Function(this, 'ThumbnailLambda', {
      runtime: lambda.Runtime.PYTHON_3_8,
      code: lambda.Code.fromAsset(thumbnailLambdaCodePath),
      handler: 'handler.lambda_handler',
      tracing: lambda.Tracing.ACTIVE,
      layers: [powertoolsLayer],
      timeout: cdk.Duration.seconds(5),
      memorySize: 256,
      environment: {
        LOG_LEVEL: props.lambdaLogLevel,
        POWERTOOLS_SERVICE_NAME: 'image-upload',
        THUMBNAIL_WIDTH: props.thumbnailWidth.toString(),
        THUMBNAIL_HEIGHT: props.thumbnailHeight.toString(),
        THUMBNAIL_BUCKET: props.destinationBucket.bucketName,
        THUMBNAIL_PREFIX: props.destinationPrefix
      },
      currentVersionOptions: {
        codeSha256: calculateSha256(thumbnailLambdaCodePath)
      }
    });
    props.destinationBucket.grantReadWrite(thumbnailLambda);

    const imageUploadedEventSource = new events.SnsEventSource(
      props.imageUploadedTopic
    );
    imageUploadedEventSource.bind(thumbnailLambda);
  }
}