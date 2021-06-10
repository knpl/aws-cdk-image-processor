import * as cdk from '@aws-cdk/core';
import * as cog from '@aws-cdk/aws-cognito';
import {ImageUploadApi} from './image-upload-api';
import {ObservableBucket} from './observable-bucket';
import {ThumbnailLambda} from './thumbnail-lambda';


export class IacStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const userPoolArn = scope.node.tryGetContext("cognitoUserPoolArn") as string;
    if (!userPoolArn) {
      throw new Error("Missing required property in context: 'cognitoUserPoolArn'");
    }
    const userPool = cog.UserPool.fromUserPoolArn(this, 'UserPool', userPoolArn);

    const audience = scope.node.tryGetContext("audience") as string
    if (!audience) {
      throw new Error("Missing required property in context: 'audience'");
    }

    const observableBucket = new ObservableBucket(this, 'ObservableBucket', {
      prefix: 'images/',
      lambdaLogLevel: 'INFO'
    });

    new ThumbnailLambda(this, 'ThumbnailLambdaObs', {
      imageUploadedTopic:  observableBucket.imageUploadedTopic,
      destinationBucket: observableBucket.imageUploadBucket,
      destinationPrefix: 'thumbnails/',
      lambdaLogLevel: 'INFO'
    });

    new ImageUploadApi(this, 'ImageUploadApi', {
      imageUploadBucket: observableBucket.imageUploadBucket,
      prefix: 'images/',
      cognitoUserPool: userPool,
      audience: audience
    });
  }
}
