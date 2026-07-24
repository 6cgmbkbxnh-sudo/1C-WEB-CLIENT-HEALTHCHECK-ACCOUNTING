const dgram = require('dgram');
const zlib = require('zlib');

/**
 * Zabbix sender implementation using Zabbix Protocol (UDP).
 * Sends metrics to Zabbix trapper without external dependencies.
 */
class ZabbixSender {
  constructor({ host = 'localhost', port = 10051, source = '1c-healthcheck' }) {
    this.host = host;
    this.port = port;
    this.source = source;
    this.client = dgram.createSocket('udp4');
  }

  /**
   * Compress data using zlib as Zabbix expects ZlibCompression
   */
  _compress(data) {
    return zlib.deflateSync(data);
  }

  /**
   * Send data to Zabbix server
   * @param {Array<{host: string, key: string, value: string, clock?: number}>} items
   * @returns {Promise<Object>} response from Zabbix
   */
  async send(items) {
    return new Promise((resolve, reject) => {
      const clock = Math.floor(Date.now() / 1000);

      // Build JSON payload
      const payload = {
        request: 'sender data',
        data: items.map(item => ({
          host: item.host,
          key: item.key,
          value: item.value,
          clock,
        })),
        clock,
      };

      const jsonPayload = JSON.stringify(payload);

      // Zabbix protocol: header "ZBXD\0" + 4-byte data length + compressed data
      const header = Buffer.from('ZBXD\0', 'utf8');
      const compressed = this._compress(jsonPayload);
      const dataLength = Buffer.alloc(4);
      dataLength.writeUInt32LE(compressed.length, 0);

      const message = Buffer.concat([header, dataLength, compressed]);

      const timeout = setTimeout(() => {
        this.client.close();
        reject(new Error('Zabbix send timeout'));
      }, 5000);

      this.client.on('message', (response) => {
        clearTimeout(timeout);
        try {
          const responseStr = response.toString('utf8');
          // Parse response: processed X; failed Y; total Z; required ...
          resolve({ raw: responseStr, success: responseStr.includes('processed: ') });
        } catch (e) {
          resolve({ raw: response.toString(), success: false });
        }
      });

      this.client.on('error', (err) => {
        clearTimeout(timeout);
        this.client.close();
        reject(err);
      });

      this.client.send(message, 0, message.length, this.port, this.host, (err) => {
        if (err) {
          clearTimeout(timeout);
          this.client.close();
          reject(err);
        }
      });
    });
  }

  close() {
    try {
      this.client.close();
    } catch (e) {
      // Socket may already be closed
    }
  }
}

module.exports = ZabbixSender;
