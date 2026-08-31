"""Client S3, miroir Python de packages/utils/src/s3.ts (createS3Client). ocr-worker ne fait que
télécharger l'original : pas d'upload_file ici, contrairement à thumbnail-worker."""

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
