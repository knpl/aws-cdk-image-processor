from typing import Dict, Any
import os
import json

import boto3
import  mypy_boto3_sns as sns

from aws_lambda_powertools.logging import Logger
from aws_lambda_powertools.tracing import Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.utilities.data_classes import S3Event


SNS_TOPIC_ARN: str = os.environ['SNS_TOPIC_ARN']
SNS: sns.SNSClient = boto3.client('sns')

logger = Logger()
tracer = Tracer()

@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
def lambda_handler(event_dict: Dict[str, Any], context: LambdaContext):
    """
    Forwards bucket and key to the SNS topic.
    """
    event = S3Event(event_dict)
    SNS.publish(
        TopicArn=SNS_TOPIC_ARN,
        Message=json.dumps(dict(
            Bucket=event.bucket_name,
            Key=event.object_key
        ))
    )
