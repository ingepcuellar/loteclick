import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';

function PageHeader({ title, subtitle, backTo, actions, children }) {
    return (
        <div className="page-header">
            <div className="page-header-content">
                {backTo && (
                    <Link to={backTo} className="btn btn-ghost btn-sm mb-2">
                        <FiArrowLeft /> Volver
                    </Link>
                )}
                <h1>{title}</h1>
                {subtitle && <p>{subtitle}</p>}
                {children}
            </div>
            {actions && <div className="page-header-actions">{actions}</div>}
        </div>
    );
}

export default PageHeader;
