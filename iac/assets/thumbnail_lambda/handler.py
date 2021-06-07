from typing import Dict, Any
import os
import io
import json

import boto3
import mypy_boto3_s3 as s3

from PIL import Image

from aws_lambda_powertools.utilities.typing import LambdaContext
from aws_lambda_powertools.utilities.data_classes import SNSEvent
from aws_lambda_powertools.logging import Logger
from aws_lambda_powertools.tracing import Tracer


logger = Logger()
tracer = Tracer()

THUMBNAIL_WIDTH: int = int(os.environ.get('THUMBNAIL_WIDTH', '128'))
THUMBNAIL_HEIGHT: int = int(os.environ.get('THUMBNAIL_HEIGHT', '128'))
THUMBNAIL_BUCKET: str = os.environ['THUMBNAIL_BUCKET']
THUMBNAIL_PREFIX: str = os.environ['THUMBNAIL_PREFIX'].rstrip('/')

S3: s3.Client = boto3.client('s3')


@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
def lambda_handler(event_dict: Dict[str, Any], context: LambdaContext) -> None:
    """
    Saves thumbnails of images to the thumbnail bucket.
    """
    event = SNSEvent(event_dict)
    message: Dict[str, str] = json.loads(event.record.sns.message)

    key = message['Key']
    bucket = message['Bucket']
    filename: str = os.path.splitext(os.path.basename(key))[0]

    obj = S3.get_object(Bucket=bucket, Key=key)
    obj.Body.read()

    with Image.open(io.BytesIO(obj.Body.read())) as im:
        im.thumbnail((THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT))
        
        outstream = io.BytesIO()
        im.save(outstream, 'PNG')
        outstream.seek(0)

        S3.put_object(
            Bucket=THUMBNAIL_BUCKET,
            Key=f'{THUMBNAIL_PREFIX}/{filename}.png',
            Body=outstream
        )
