"""Client S3, miroir Python de packages/utils/src/s3.ts (createS3Client)"""

import boto3
from botocore.client import Config as BotoConfig

from .config import Config


def create_s3_client(config: Config):
    return boto3.client(
        "s3",
        region_name=config.aws_region,
        endpoint_url=config.s3_endpoint,
        aws_access_key_id=config.aws_access_key_id,
        aws_secret_access_key=config.aws_secret_access_key,
        config=BotoConfig(s3={"addressing_style": "path"} if config.s3_endpoint else {}),
    )


def download_to_file(s3_client, bucket: str, key: str, local_path: str) -> None:
    s3_client.download_file(bucket, key, local_path)


def upload_file(s3_client, bucket: str, key: str, local_path: str, content_type: str) -> None:
    s3_client.upload_file(
        local_path, bucket, key, ExtraArgs={"ContentType": content_type}
    )
