import { NextPageContext } from "next"

interface ErrorProps {
  statusCode?: number
}

function Error({ statusCode }: ErrorProps) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      textAlign: "center",
      fontFamily: "system-ui, sans-serif",
      padding: "20px",
    }}>
      <h1 style={{ fontSize: "72px", fontWeight: 700, color: "#999", margin: 0 }}>
        {statusCode || "Error"}
      </h1>
      <p style={{ fontSize: "18px", color: "#666", marginTop: "16px" }}>
        {statusCode === 404
          ? "Page not found"
          : statusCode === 500
          ? "Internal server error"
          : "An error occurred"}
      </p>
      <a
        href="/"
        style={{
          marginTop: "24px",
          padding: "12px 24px",
          backgroundColor: "#0070f3",
          color: "white",
          textDecoration: "none",
          borderRadius: "8px",
          fontSize: "16px",
        }}
      >
        Back to Dashboard
      </a>
    </div>
  )
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}

export default Error
