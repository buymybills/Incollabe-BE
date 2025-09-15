import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiConsumes } from '@nestjs/swagger';

export function ApiFile(fileName: string = 'file'): MethodDecorator {
  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        properties: {
          [fileName]: {
            type: 'string',
            format: 'binary',
          },
        },
      },
    }),
  );
}

export function ApiFileFields(
  files: string[],
  otherFields?: any,
): MethodDecorator {
  const properties: any = {};

  files.forEach((file) => {
    properties[file] = {
      type: 'string',
      format: 'binary',
    };
  });

  if (otherFields) {
    Object.assign(properties, otherFields);
  }

  return applyDecorators(
    ApiConsumes('multipart/form-data'),
    ApiBody({
      schema: {
        type: 'object',
        properties,
      },
    }),
  );
}
