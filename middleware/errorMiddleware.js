export const errorHandler = (err, req, res, next) => {
  console.error(`Error on ${req.method} ${req.originalUrl}:`, err);
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message,
    details: err.details || null,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
};
