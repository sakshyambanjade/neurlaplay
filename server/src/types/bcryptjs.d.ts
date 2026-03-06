declare module 'bcryptjs' {
  function hash(data: string | Buffer, saltOrRounds: string | number): Promise<string>;
  function hashSync(data: string | Buffer, saltOrRounds: string | number): string;
  function compare(data: string | Buffer, encrypted: string): Promise<boolean>;
  function compareSync(data: string | Buffer, encrypted: string): boolean;
  function getRounds(encrypted: string): number;
  
  export default {
    hash,
    hashSync,
    compare,
    compareSync,
    getRounds
  };
}
