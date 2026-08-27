import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Payload thực sự nằm trong access token, được JwtAuthGuard gắn vào
 * request.user sau khi verify. Khớp với những gì AuthService.signAccessToken
 * ký vào token (xem auth.service.ts).
 */
export interface JwtPayload {
  sub: string; // user id
  email: string;
  name: string | null;
}

/**
 * Lấy user hiện tại từ request (đã được JwtAuthGuard xác thực trước đó).
 *
 * Dùng toàn bộ payload:      @CurrentUser() user: JwtPayload
 * Dùng 1 field cụ thể:       @CurrentUser('email') email: string
 *
 * Lưu ý: decorator này KHÔNG tự verify token — nó chỉ đọc lại
 * request.user đã được JwtAuthGuard set. Nếu guard không chạy trước
 * (route bị đánh dấu @Public() hoặc guard bị bypass), request.user sẽ là
 * undefined và decorator trả về undefined tương ứng.
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;

    if (!user) return undefined;
    return data ? user[data] : user;
  },
);
