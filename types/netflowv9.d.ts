declare module "@gavinaiken/netflowv9" {
  type CollectorOptions = {
    port?: number;
    cb?: (flow: any) => void;
    templateCb?: (template: any) => void;
    [k: string]: any;
  };

  interface CollectorInstance {
    listen: (port?: number) => void;
    on?: (event: string, handler: (...args: any[]) => void) => void;
  }

  const Collector: (opts?: CollectorOptions) => CollectorInstance;
  export default Collector;
}

