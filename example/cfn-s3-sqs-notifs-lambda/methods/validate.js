module.exports = function Validate(properties) {
  if (!isString(properties.Bucket)) {
    return 'String Bucket is required.';
  }
  if (!isString(properties.QueueArn)) {
    return 'String QueueArn is required.';
  }
  if (!properties.Events ||
    !Array.isArray(properties.Events) ||
    !properties.Events.length ||
    !properties.Events.every(isString)) {
    return 'Array of strings Events is required.';
  }
};

function isString(thing) {
  return 'string' === typeof thing;
}
