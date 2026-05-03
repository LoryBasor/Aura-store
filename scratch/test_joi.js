const Joi = require('joi');

const schema = Joi.object({
  cat: Joi.number().integer().positive().allow('', null)
});

const samples = ['', null, '1', '0', '-1', 'abc'];

samples.forEach(s => {
  const { error, value } = schema.validate({ cat: s });
  console.log(`Input: "${s}", Error: ${error ? error.details[0].message : 'NONE'}, Value: ${JSON.stringify(value)}`);
});
