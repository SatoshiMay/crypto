import {readFileSync} from 'fs';
// import pkgJSON from '../package.json';

const config: any = {
  // 'p2pPool': {'peerUrls': ['ws://localhost:8333']},
  // 'protocol': {'version': 1},
  'network': {'type': 'Testnet'},
  'db': {
    'uri': {
      'dev': 'mongodb://localhost:27017/dev_trinity'
      // },
      // 'prod': {
      //   'connectionString':
      //       readFileSync(`/etc/nodeapp/${name}/mongodb`).toString()
    },
    'options': {
      'keepAlive': 30000,         // in ms. Defaults to 30s
      'connectTimeoutMS': 30000,  // in ms. Defaults to 30s,
      'useNewUrlParser': true,
      'promoteBuffers': true
    }
  }
};

export default config;
