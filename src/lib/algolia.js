import algoliasearch from 'algoliasearch';

export const client = algoliasearch(
	process.env.ALGOLIA_APP_ID,
	process.env.ALGOLIA_API_KEY
);

export const ProductIndex = client.initIndex('products_dev');
