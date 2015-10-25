
module.exports = function equalNotificationParams(a, b) {
  return a.QueueArn === b.QueueArn &&
    a.Events.slice(0).sort().join('|') === b.Events.slice(0).sort().join('|');
};
