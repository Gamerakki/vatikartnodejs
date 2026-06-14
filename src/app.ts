import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import compression from 'compression';
import { logger } from './config/logger';
import { userActivityMiddleware } from './middlewares/userActivity';
import { userRouter } from './modules/user/user.router';
import { companyRouter } from './modules/company/company.router';
import { catalogueRouter } from './modules/catalogue/catalogue.router';
import { productRouter } from './modules/product/product.router';
import { socialMediaRouter } from './modules/social_media_master/socialMedia.router';
import { orderRouter } from './modules/order/order.router';
import { adminRouter } from './modules/admin/admin.router';
import { analyticsRouter } from './modules/analytics/analytics.router';
import { customerGroupRouter } from './modules/customer-group/customerGroup.router';
import { whatsappTemplateRouter } from './modules/whatsapp-template/whatsappTemplate.router';

const app = express();

// Enable Gzip compression to reduce API payload weights (often by 70%+)
app.use(compression());

// Set up CORS configurations mirroring the Go backend
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',');
const allowedMethods = (process.env.ALLOWED_METHODS || 'GET,POST,PUT,DELETE,OPTIONS,PATCH').split(',');
const envHeaders = process.env.ALLOWED_HEADERS || 'Content-Type,Authorization';
const allowedHeaders = `${envHeaders},customer-phone`.split(',');
const exposedHeaders = (process.env.EXPOSE_HEADERS || 'Content-Length,Authorization').split(',');
const allowCredentials = process.env.ALLOW_CREDENTIALS !== 'false';

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      const isLocalhost = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (isLocalhost || allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    methods: allowedMethods,
    allowedHeaders: allowedHeaders,
    exposedHeaders: exposedHeaders,
    credentials: allowCredentials,
  })
);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global User Activity Middleware
app.use(userActivityMiddleware);

// Static files directory
const staticFileDir = process.env.STATIC_FILE_DIR || '/public';
if (staticFileDir) {
  // Go uses helpers.GetFilePath(staticFileDir) which points to current_working_dir + staticFileDir
  const absoluteStaticPath = path.isAbsolute(staticFileDir)
    ? staticFileDir
    : path.join(process.cwd(), staticFileDir);
  app.use(staticFileDir, express.static(absoluteStaticPath));
  logger.info(`Static directory mounted: ${staticFileDir} -> ${absoluteStaticPath}`);
}

// Robots.txt
app.get('/robots.txt', (req: Request, res: Response) => {
  res.type('text/plain');
  res.send('User-agent: *\nDisallow: /');
});

// Mounting Module Routers
app.use('/user', userRouter);
app.use('/company', companyRouter);
app.use('/catalogue', catalogueRouter);
app.use('/product', productRouter);
app.use('/master', socialMediaRouter);
app.use('/order', orderRouter);
app.use('/admin', adminRouter);
app.use('/analytics', analyticsRouter);
app.use('/customer-group', customerGroupRouter);
app.use('/whatsapp-template', whatsappTemplateRouter);

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled request error', err);
  res.status(500).json({
    status: false,
    msg: 'An internal server error occurred',
    error: err.message || err,
  });
});

export default app;
