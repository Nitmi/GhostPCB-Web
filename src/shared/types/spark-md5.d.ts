declare module 'spark-md5' {
  const SparkMD5: {
    hash(value: string, raw?: boolean): string
  }

  export default SparkMD5
}
