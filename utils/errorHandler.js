function errorHandler(err, req, res, next) {
  console.error('[ERROR]', err.stack || err.message);
  res.status(500).render('error', {
    title: 'Error',
    message: err.message || 'Something went wrong'
  });
}

module.exports = errorHandler;
