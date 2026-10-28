import { ConsoleLogger, Injectable } from '@nestjs/common';

@Injectable()
export class AppLogger extends ConsoleLogger {
  override log(message: unknown, context?: string): void {
    // Saring log spam mapping route dan loading modul NestJS internal
    if (
      process.env.DEBUG_ROUTES !== 'true' &&
      (context === 'RouterExplorer' ||
        context === 'InstanceLoader' ||
        context === 'RoutesResolver')
    ) {
      return;
    }
    super.log(message, context);
  }
}
