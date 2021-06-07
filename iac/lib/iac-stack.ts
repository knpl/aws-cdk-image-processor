import * as cdk from '@aws-cdk/core';
import {ObservableBucket} from './observable-bucket';

import * as lambda from '@aws-cdk/aws-lambda';
import * as events from '@aws-cdk/aws-lambda-event-sources';
import {calculateSha256} from './tools';


export class IacStack extends cdk.Stack {

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const observableBucket = new ObservableBucket(this, 'ObservableBucket', {
      prefix: 'images/',
      lambdaLogLevel: 'INFO'
    });

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
          LOG_LEVEL: 'INFO',
          POWERTOOLS_SERVICE_NAME: 'image-upload',
          THUMBNAIL_WIDTH: '128',
          THUMBNAIL_HEIGHT: '128',
          THUMBNAIL_BUCKET: observableBucket.imageUploadBucket.bucketName,
          THUMBNAIL_PREFIX: 'thumbnails/'
        },
        currentVersionOptions: {
          codeSha256: calculateSha256(thumbnailLambdaCodePath)
        }
    });
    observableBucket.imageUploadBucket.grantReadWrite(thumbnailLambda);

    const imageUploadedEventSource = new events.SnsEventSource(
      observableBucket.imageUploadedTopic
    );
    imageUploadedEventSource.bind(thumbnailLambda);
    
    
  }
}
