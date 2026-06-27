import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  Res,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Response } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ListOrdersQueryDto } from './dto/list-orders-query.dto';
import { TransitionStatusDto } from './dto/transition-status.dto';
import { OrderResponseDto } from './dto/order-response.dto';

/**
 * T-16: Orders HTTP Controller (SPEC.md §8)
 * CRITICAL IMPLEMENTATION DETAILS:
 * - Route ordering: Static routes BEFORE parameterized routes (avoid Express collision)
 * - UUID validation via ParseUUIDPipe (rejects invalid UUIDs BEFORE service call)
 * - Idempotency replay: 201 (new) vs 200 (replay) via @Res({ passthrough: true })
 * - ALL responses transformed to OrderResponseDto (field exclusion handled by T-17 interceptor)
 * - Query params auto-validated/transformed by global ValidationPipe (T-14)
 */
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * POST /orders
   * CRITICAL: Dynamic status code (201 new / 200 replay) WITHOUT bypassing interceptors
   * Uses @Res({ passthrough: true }) to maintain ClassSerializerInterceptor compatibility
   */
  @Post()
  async create(
    @Body() dto: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderResponseDto> {
    const { order, created } = await this.ordersService.create(dto, idempotencyKey);
    res.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return new OrderResponseDto(order);
  }

  /**
   * GET /orders
   * Returns paginated order list with envelope shape
   * Query params validated/transformed by global ValidationPipe (T-14)
   */
  @Get()
  async findAll(@Query() query: ListOrdersQueryDto): Promise<{
    data: OrderResponseDto[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { data, total, page, pageSize } = await this.ordersService.findAll(query);
    return {
      data: data.map((order) => new OrderResponseDto(order)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * GET /orders/:id
   * CRITICAL: ParseUUIDPipe validates UUID format BEFORE service call
   * Rejects malformed UUIDs with 400 (not 404) per SPEC.md §8.2
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<OrderResponseDto> {
    const order = await this.ordersService.findOne(id);
    return new OrderResponseDto(order);
  }

  /**
   * PATCH /orders/:id/status
   * CRITICAL: ParseUUIDPipe validates UUID format BEFORE service call
   * Status transition validated by service layer (T-13 CAS pattern)
   */
  @Patch(':id/status')
  async transitionStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TransitionStatusDto,
  ): Promise<OrderResponseDto> {
    const order = await this.ordersService.transitionStatus(id, dto.status);
    return new OrderResponseDto(order);
  }
}
