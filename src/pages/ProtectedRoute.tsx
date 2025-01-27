import { Navigate } from "react-router";

const ProtectedRoute = ({ children }) => {
  const isAuthorized = localStorage.getItem("ls_wallet_address");

  if (!isAuthorized) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
