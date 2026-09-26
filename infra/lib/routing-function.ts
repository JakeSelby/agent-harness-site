/** The one host the site answers on; every other name the distribution carries 301s here. */
export const CANONICAL_HOST = 'model-citizen.dev';

/**
 * Source of the viewer-request CloudFront Function (runtime cloudfront-js-2.0).
 *
 * A distribution takes one function per event type, so the host redirect and the clean-URL
 * rewrite share it. Any host other than the apex (www, the retired agent-harness.jakeselby.com)
 * gets a 301 to the same path and query string on the apex. On the apex, Astro writes
 * skills/plan-authoring/index.html, so without the rewrite /skills/plan-authoring/ is a missing
 * key and S3 answers 403.
 *
 * Query string values reach the function as the viewer sent them, so they are joined back
 * unchanged rather than re-encoded.
 */
export const ROUTING_FUNCTION_CODE = `
function queryString(qs) {
  var parts = [];
  for (var name in qs) {
    var field = qs[name];
    var values = field.multiValue ? field.multiValue : [field];
    for (var i = 0; i < values.length; i++) {
      parts.push(name + '=' + values[i].value);
    }
  }
  return parts.length ? '?' + parts.join('&') : '';
}

function handler(event) {
  var request = event.request;
  var host = request.headers.host ? request.headers.host.value.toLowerCase() : '';
  if (host !== '${CANONICAL_HOST}') {
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: {
        location: { value: 'https://${CANONICAL_HOST}' + request.uri + queryString(request.querystring || {}) },
      },
    };
  }
  var uri = request.uri;
  if (uri.endsWith('/')) {
    request.uri += 'index.html';
  } else if (!uri.includes('.')) {
    request.uri += '/index.html';
  }
  return request;
}
`.trim();
