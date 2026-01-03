const webpush = require('web-push');

const publicVapidKey = 'BAtSKsIVOlkH_DjFTS-vT1ysvHmsCm45SSutJpY-iFPwwbNvR6f6T7CLivUuBQpkxRtlSfltSXNRzuQZ9aa_sfY';
const privateVapidKey = '5QS6-xUfROiWnReXaN6U5fnnwVWhPwcXzxw7u1E59Ds';

webpush.setVapidDetails(
  'mailto:akadirizeno@gmail.com', // Using a generic or user specific email
  publicVapidKey,
  privateVapidKey
);

module.exports = {
  webpush,
  publicVapidKey
};
