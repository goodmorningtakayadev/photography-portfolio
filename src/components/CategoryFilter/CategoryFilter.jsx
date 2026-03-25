import './CategoryFilter.css';

const CategoryFilter = ({ categories, activeCategory, onCategoryChange }) => {
  return (
    <div className="cf">
      <button
        className={`cf-btn ${activeCategory === 'all' ? 'active' : ''}`}
        onClick={() => onCategoryChange('all')}
      >
        <span className="cf-btn-text">All Work</span>
        <span className="cf-btn-bar" />
      </button>
      {categories.map((cat) => (
        <button
          key={cat.id}
          className={`cf-btn ${activeCategory === cat.id ? 'active' : ''}`}
          onClick={() => onCategoryChange(cat.id)}
        >
          <span className="cf-btn-text">{cat.name}</span>
          <span className="cf-btn-bar" />
        </button>
      ))}
    </div>
  );
};

export default CategoryFilter;
