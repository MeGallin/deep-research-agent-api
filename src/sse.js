const subscribersByRun = new Map();

function getSubscriberSet(runId) {
  if (!subscribersByRun.has(runId)) {
    subscribersByRun.set(runId, new Set());
  }
  return subscribersByRun.get(runId);
}

function subscribe(runId, res) {
  const subscribers = getSubscriberSet(runId);
  subscribers.add(res);
  return () => unsubscribe(runId, res);
}

function unsubscribe(runId, res) {
  const subscribers = subscribersByRun.get(runId);
  if (!subscribers) {
    return;
  }
  subscribers.delete(res);
  if (subscribers.size === 0) {
    subscribersByRun.delete(runId);
  }
}

function writeEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function publish(runId, event, data) {
  const subscribers = subscribersByRun.get(runId);
  if (!subscribers) {
    return;
  }
  subscribers.forEach((res) => {
    writeEvent(res, event, data);
  });
}

module.exports = {
  subscribe,
  unsubscribe,
  publish,
  writeEvent
};
