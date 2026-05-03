const { productSchema } = require('../src/utils/validators');

const samples = [
  {
    name: 'Test Product',
    price: '1000',
    category_id: '',
    is_available: 'true'
  },
  {
    name: 'TP', // too short
    price: '1000',
    category_id: '',
    is_available: 'true'
  },
  {
    name: 'Empty Stock',
    price: '1000',
    stock_quantity: ''
  }
];

samples.forEach((sample, i) => {
  const { error, value } = productSchema.validate(sample, { abortEarly: false, stripUnknown: true });
  console.log(`Sample ${i}:`, error ? 'FAILED' : 'SUCCESS');
  if (error) console.log('Errors:', error.details.map(d => d.message));
  else console.log('Value:', value);
});
