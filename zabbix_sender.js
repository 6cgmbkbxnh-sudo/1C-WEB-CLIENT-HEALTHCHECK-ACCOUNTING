const ZabbixSenderLib = require('node-zabbix-sender');

/**
 * Zabbix sender wrapper using node-zabbix-sender library.
 * Sends metrics to Zabbix trapper via TCP.
 */
class ZabbixSender {
  constructor({ host = 'localhost', port = 10051, source = '1c-healthcheck' }) {
    this.host = host;
    this.port = port;
    this.source = source;
    this.sender = new ZabbixSenderLib({ host, port });
  }

  /**
   * Send data to Zabbix server
   * @param {Array<{host: string, key: string, value: string, clock?: number}>} items
   * @returns {Promise<Object>} response from Zabbix
   */
  async send(items) {
    return new Promise((resolve, reject) => {
      for (const item of items) {
        this.sender.addItem(item.host, item.key, item.value);
      }
      this.sender.send((err, res, allItems) => {
        console.log(`Zabbix send response: ${JSON.stringify(res)}`);
        console.log(`Zabbix send items: ${JSON.stringify(allItems)}`);
        console.log(`Zabbix send error: ${err ? err.message : 'none'}`);
        if (err) {
          reject(err);
        } else {
          resolve({ raw: JSON.stringify(res), success: true });
        }
      });
    });
  }

  close() {
    // node-zabbix-sender doesn't need explicit close
  }
}

module.exports = ZabbixSender;
