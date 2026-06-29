import { join } from 'path';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(__dirname, '/../**/*.entity.js')],
  migrations: [join(__dirname, '/../migrations/*.js')],
  logging: false,
});
