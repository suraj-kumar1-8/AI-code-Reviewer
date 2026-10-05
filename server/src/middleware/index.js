// Prepared for Day 2+ Auth & Request Validation Middlewares
export const authMiddleware = (req, res, next) => next();
export const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
};
