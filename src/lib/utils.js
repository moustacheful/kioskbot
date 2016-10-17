import _ from 'lodash';

/**
 * Groups properties into logical nested properties. 
 * e.g: user_id, user_name -> user: {id, name}
 * 
 * @param  {object}
 * @return {object}
 */
export function nestify(incoming){
	const keys = _.keys(incoming);

	const simpleKeys = _.reduce(keys, (accumulator, key) => {
		const [segment, ...rest] = key.split('_');
		if(!rest.length){
			accumulator.push(key);
		}else {
			const results = _.countBy(keys, k => _.includes(k, segment + '_'))
			if(results.true < 2){
				accumulator.push(key);
			}				
		}
		return accumulator;
	}, [])

	const nested = _.reduce(_.omit(incoming, ...simpleKeys), (a,v,k) => {
		const [segment, ...rest] = k.split('_');
		_.set(a, `${segment}.${rest.join('_')}`, v);

		return a;
	}, {})
	
	const simple = _.pick(incoming, ...simpleKeys);
	
	return { ...simple, ...nested };
};

/**
 * Flattens an object using their parent's namespace. 
 * e.g: user: {id, name} -> user_id, user_name
 * 
 * @param  {object}
 * @return {object}
 */
export function denestify(incoming) {
	return _.reduce(incoming, (accumulator, value, key) => {
		if (_.isObject(value) && !_.isArray(value)) {
			const flattened = _.mapKeys(value, (subValue, subKey) => `${key}_${subKey}`);
			return { ...accumulator, ...flattened };
		}

		accumulator[key] = value;
		return accumulator;
	}, {});
}
