import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderEntity } from './entities/order.entity';
import { OrdersService } from './orders.service';

/**
 * T-10: Minimal OrdersModule for service layer
 * Will be expanded in T-16 with controller registration
 */
@Module({
  imports: [TypeOrmModule.forFeature([OrderEntity])],
  providers: [OrdersService],
  exports: [OrdersService], // Required for controller injection (T-16)
})
export class OrdersModule {}
