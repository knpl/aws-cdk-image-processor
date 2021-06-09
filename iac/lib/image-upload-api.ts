import * as cdk from '@aws-cdk/core';
import * as agw from '@aws-cdk/aws-apigateway';
import * as iam from '@aws-cdk/aws-iam';
import {IUserPool} from '@aws-cdk/aws-cognito';

import {IBucket} from '@aws-cdk/aws-s3';
import {rstripslash} from './tools';


export interface ImageUploadApiProps {
  imageUploadBucket: IBucket
  cognitoUserPool: IUserPool
  prefix?: string
  throttlingRateLimit?: number
  throttlingBurstLimit?: number
}

export class ImageUploadApi extends cdk.Construct {
  constructor(scope: cdk.Construct, id: string, props: ImageUploadApiProps) {
    super(scope, id);

    

    const api = new agw.RestApi(this, 'ImageUploadRestApi', {
      binaryMediaTypes: ['*/*'],
      deployOptions: {
        throttlingRateLimit: props.throttlingRateLimit ?? 10,
        throttlingBurstLimit: props.throttlingBurstLimit ?? 5
      }
    });
    api.addGatewayResponse('Default4XX', {
      type: agw.ResponseType.DEFAULT_4XX,
      templates: {
        'application/json': '{"message": $context.error.messageString }'
      }
    });
    api.addGatewayResponse('Default5XX', {
      type: agw.ResponseType.DEFAULT_5XX,
      templates: {
        'application/json': '{"message": $context.error.messageString }'
      }
    });
    const itemResource = api.root.addResource('images').addResource('{item}');
    
    const pathGlob = props.prefix ? `${rstripslash(props.prefix)}/*` : '*';
    const imageUploadPolicy = new iam.ManagedPolicy(this, 'AGWUploadImagePolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            's3:PutObject',
            's3:GetObject'
          ],
          resources: [
            `${props.imageUploadBucket.bucketArn}/${pathGlob}`
          ]
        })
      ]
    });
    
    const s3UploadIntegration = new agw.AwsIntegration({
      service: 's3',
      integrationHttpMethod: 'PUT',
      path: `{bucket}/${props.prefix ? rstripslash(props.prefix)+'/' : ''}{key}`,
      options: {
        requestParameters: {
          'integration.request.path.bucket': `'${props.imageUploadBucket.bucketName}'`,
          'integration.request.path.key': 'method.request.path.item'
        },
        credentialsRole: new iam.Role(this, 'AGWUploadImageRole', {
          assumedBy: new iam.ServicePrincipal('apigateway.amazonaws.com'),
          managedPolicies: [imageUploadPolicy]
        }),
        integrationResponses: [
          { statusCode: '200' },
          {
            selectionPattern: '403',
            statusCode: '403',
            responseTemplates: { 'application/xml': '{"message": "$util.base64Encode($input.body)"}' }
          },
          {
            selectionPattern: '400',
            statusCode: '400',
            responseTemplates: { 'application/xml': '{"message": "$util.base64Encode($input.body)"}' }
          },
          {
            selectionPattern: '5\\d\\d',
            statusCode: '500',
            responseTemplates: { 'application/xml': '{"message": "$util.base64Encode($input.body)"}' }
          }
        ]
      }
    });

    itemResource.addMethod('PUT', s3UploadIntegration, {
      requestParameters: {
        'method.request.path.item': true
      },
      methodResponses: [
        { statusCode: '200' },
        { statusCode: '403', responseModels: { 'application/json': agw.Model.ERROR_MODEL }},
        { statusCode: '400', responseModels: { 'application/json': agw.Model.ERROR_MODEL }},
        { statusCode: '500', responseModels: { 'application/json': agw.Model.ERROR_MODEL }}
      ],
      authorizationType: agw.AuthorizationType.COGNITO,
      authorizer: new agw.CognitoUserPoolsAuthorizer(this, 'CognitoUserPoolsAuthorizer', {
        cognitoUserPools: [props.cognitoUserPool],
        resultsCacheTtl: cdk.Duration.hours(1),
        identitySource: agw.IdentitySource.header('Authorization')
      })
    });
    
  }
}