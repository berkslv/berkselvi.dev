import Document, { Html, Head, Main, NextScript } from 'next/document'

export default class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head />
        <body className="bg-prime-1000">
          <Main />
          <NextScript />
        </body>
      </Html>
    )
  }
}
