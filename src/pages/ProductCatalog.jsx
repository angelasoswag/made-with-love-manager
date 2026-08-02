import {
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  addProduct,
  archiveProduct,
  deleteProduct,
  getOrders,
  getProducts,
  reactivateProduct,
  updateProduct
} from "../db/database";

const EMPTY_FORM = {
  name: "",
  category: "Sticker",
  price: "",
  stock: "",
  image: null
};

const CATEGORIES = [
  "Sticker",
  "Sticker Pack",
  "Postcard",
  "Apparel",
  "Print",
  "Other"
];

function getImageUrl(image) {
  if (!image) return "";

  return typeof image === "string"
    ? image
    : URL.createObjectURL(image);
}

function ProductCatalog() {
  const formRef = useRef(null);
  const restockRef = useRef(null);

  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [showArchived, setShowArchived] =
    useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [imagePreview, setImagePreview] =
    useState("");

  useEffect(() => {
    loadCatalogData();
  }, []);

  async function loadCatalogData() {
    try {
      const [savedProducts, savedOrders] =
        await Promise.all([
          getProducts(),
          getOrders()
        ]);

      setProducts(
        [...savedProducts].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );

      setOrders(savedOrders);
    } catch (error) {
      console.error(error);
      alert("The product catalog could not be loaded.");
    }
  }

  const productInsights = useMemo(() => {
    const sales = new Map();

    orders.forEach((order) => {
      const orderDate =
        order.orderDate ||
        order.createdAt ||
        order.created_at;

      (order.items || []).forEach((item) => {
        if (!item.productId) return;

        const current = sales.get(item.productId) || {
          unitsSold: 0,
          revenue: 0,
          lastSoldAt: null
        };

        const isNewer =
          orderDate &&
          (!current.lastSoldAt ||
            new Date(orderDate) >
              new Date(current.lastSoldAt));

        sales.set(item.productId, {
          unitsSold:
            current.unitsSold +
            (Number(item.quantity) || 0),

          revenue:
            current.revenue +
            (Number(item.lineRevenue) || 0),

          lastSoldAt: isNewer
            ? orderDate
            : current.lastSoldAt
        });
      });
    });

    return products.map((product) => {
      const productSales =
        sales.get(product.id) || {
          unitsSold: 0,
          revenue: 0,
          lastSoldAt: null
        };

      const stock = Number(product.stock) || 0;

      const threshold =
        Number(product.low_stock_threshold) || 2;

      return {
        ...product,
        stock,
        unitsSold: productSales.unitsSold,
        salesRevenue: productSales.revenue,
        lastSoldAt: productSales.lastSoldAt,
        isLowStock:
          product.active !== false &&
          stock <= threshold
      };
    });
  }, [products, orders]);

  const activeProducts = useMemo(
    () =>
      productInsights.filter(
        (product) => product.active !== false
      ),
    [productInsights]
  );

  const lowStockProducts = useMemo(
    () =>
      activeProducts
        .filter((product) => product.isLowStock)
        .sort((a, b) => a.stock - b.stock),
    [activeProducts]
  );

  const displayedProducts = useMemo(() => {
    const search =
      searchText.trim().toLowerCase();

    return productInsights.filter((product) => {
      const matchesStatus =
        showArchived ||
        product.active !== false;

      const matchesSearch =
        !search ||
        product.name
          .toLowerCase()
          .includes(search) ||
        String(product.category || "")
          .toLowerCase()
          .includes(search);

      return matchesStatus && matchesSearch;
    });
  }, [
    productInsights,
    searchText,
    showArchived
  ]);

  const bestSellers = useMemo(
    () =>
      [...productInsights]
        .filter((product) => product.unitsSold > 0)
        .sort(
          (a, b) =>
            b.unitsSold - a.unitsSold ||
            b.salesRevenue - a.salesRevenue
        )
        .slice(0, 3),
    [productInsights]
  );

  const totalStock = activeProducts.reduce(
    (total, product) =>
      total + product.stock,
    0
  );

  function scrollToRestock() {
    restockRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function scrollToForm() {
    setTimeout(() => {
      formRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    }, 100);
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function clearPreview() {
    if (imagePreview.startsWith("blob:")) {
      URL.revokeObjectURL(imagePreview);
    }
  }

  function resetForm() {
    clearPreview();
    setForm(EMPTY_FORM);
    setImagePreview("");
    setEditingId(null);
    setShowForm(false);
  }

  function startAddingProduct() {
    clearPreview();
    setForm(EMPTY_FORM);
    setImagePreview("");
    setEditingId(null);
    setShowForm(true);
    scrollToForm();
  }

  function startEditingProduct(product) {
    clearPreview();

    setEditingId(product.id);

    setForm({
      name: product.name,
      category:
        product.category || "Sticker",
      price: String(product.price ?? ""),
      stock: String(product.stock ?? ""),
      image: product.image || null
    });

    setImagePreview(
      getImageUrl(product.image)
    );

    setShowForm(true);
    scrollToForm();
  }

  function handleImageChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert(
        "Please choose an image smaller than 8 MB."
      );
      return;
    }

    clearPreview();

    setForm((current) => ({
      ...current,
      image: file
    }));

    setImagePreview(
      URL.createObjectURL(file)
    );
  }

  function removeImage() {
    clearPreview();

    setForm((current) => ({
      ...current,
      image: null
    }));

    setImagePreview("");
  }

  async function saveProduct() {
    const name = form.name.trim();
    const price = Number(form.price);
    const stock = Number(form.stock);

    if (!name) {
      alert("Enter the product name.");
      return;
    }

    if (
      form.price === "" ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      alert("Enter a valid selling price.");
      return;
    }

    if (
      form.stock === "" ||
      !Number.isInteger(stock) ||
      stock < 0
    ) {
      alert(
        "Enter a valid whole-number stock amount."
      );
      return;
    }

    const productData = {
      name,
      category: form.category,
      price,
      stock,
      low_stock_threshold: 2,
      image: form.image
    };

    try {
      if (editingId) {
        await updateProduct(
          editingId,
          productData
        );
      } else {
        await addProduct({
          ...productData,
          active: true
        });
      }

      resetForm();
      await loadCatalogData();
    } catch (error) {
      console.error(error);

      alert(
        `The product could not be saved.\n\n${
          error.message || "Unknown error"
        }`
      );
    }
  }

  async function toggleStatus(product) {
    try {
      if (product.active === false) {
        await reactivateProduct(product.id);
      } else {
        await archiveProduct(product.id);
      }

      await loadCatalogData();
    } catch (error) {
      console.error(error);
      alert("The product could not be updated.");
    }
  }

  async function removeProduct(product) {
    const confirmed = window.confirm(
      `Delete "${product.name}"?\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deleteProduct(product.id);
      await loadCatalogData();
    } catch (error) {
      console.error(error);
      alert("The product could not be deleted.");
    }
  }

  async function restockProduct(product) {
    const amount = window.prompt(
      `How many ${product.name} should be added?`,
      "10"
    );

    if (amount === null) return;

    const quantity = Number(amount);

    if (
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      alert(
        "Enter a whole number greater than 0."
      );
      return;
    }

    try {
      await updateProduct(product.id, {
        stock:
          (Number(product.stock) || 0) +
          quantity
      });

      await loadCatalogData();

      alert(
        `📦 Added ${quantity} to ${product.name}.`
      );
    } catch (error) {
      console.error(error);

      alert(
        `The product could not be restocked.\n\n${
          error.message || "Unknown error"
        }`
      );
    }
  }

  function formatLastSold(date) {
    if (!date) return "Never";

    return new Date(date).toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric"
      }
    );
  }

  function PodiumProduct({
    product,
    place,
    medal
  }) {
    if (!product) return null;

    return (
      <article
        className={`podium-product place-${place}`}
      >
        <span className="podium-medal">
          {medal}
        </span>

        <div className="podium-image">
          {product.image ? (
            <img
              src={getImageUrl(product.image)}
              alt={product.name}
            />
          ) : (
            <span>💌</span>
          )}
        </div>

        <h3>{product.name}</h3>

        <strong>
          {product.unitsSold} sold
        </strong>

        <small>
          ${product.salesRevenue.toFixed(2)} revenue
        </small>

        <div className="podium-block">
          {place}
        </div>
      </article>
    );
  }

  return (
    <main className="app catalog-page">
      <header className="page-header catalog-page-header">
        <div className="catalog-heading-row">
          <div>
            <h1>Product Catalog</h1>

            <p className="page-description">
              Manage products, inventory, and
              performance.
            </p>
          </div>

          <button
            type="button"
            className="add-product-button"
            onClick={startAddingProduct}
          >
            ＋ Add Product
          </button>
        </div>
      </header>

      <section className="catalog-summary">
        <article>
          <span>🌷 Active Products</span>
          <strong>{activeProducts.length}</strong>
        </article>

        <article>
          <span>📦 Units in Stock</span>
          <strong>{totalStock}</strong>
        </article>

        <article
          className="low-stock-summary"
          onClick={scrollToRestock}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" ||
              event.key === " "
            ) {
              scrollToRestock();
            }
          }}
        >
          <span>⚠️ Low Stock</span>
          <strong>{lowStockProducts.length}</strong>
          <small>Tap to view</small>
        </article>
      </section>

      <section className="best-seller-section">
        <div className="best-seller-heading">
          <p className="section-eyebrow">
            Product performance
          </p>

          <h2>🏆 Best Sellers</h2>

          <p>Ranked by total units sold.</p>
        </div>

        {bestSellers.length ? (
          <div className="best-seller-podium">
            <PodiumProduct
              product={bestSellers[1]}
              place={2}
              medal="🥈"
            />

            <PodiumProduct
              product={bestSellers[0]}
              place={1}
              medal="🥇"
            />

            <PodiumProduct
              product={bestSellers[2]}
              place={3}
              medal="🥉"
            />
          </div>
        ) : (
          <div className="best-seller-empty">
            <span>🩰</span>

            <p>
              Best sellers will appear after you
              save orders.
            </p>
          </div>
        )}
      </section>

      {showForm && (
        <section
          className="product-form"
          ref={formRef}
        >
          <div className="form-header">
            <div>
              <p className="section-eyebrow">
                {editingId
                  ? "Edit catalog item"
                  : "New catalog item"}
              </p>

              <h2>
                {editingId
                  ? "Edit Product"
                  : "Add Product"}
              </h2>
            </div>

            <button
              type="button"
              className="close-button"
              onClick={resetForm}
              aria-label="Close product form"
            >
              ×
            </button>
          </div>

          <div className="product-form-grid">
            <div>
              <label className="field-label">
                Product name

                <input
                  type="text"
                  value={form.name}
                  onChange={(event) =>
                    updateForm(
                      "name",
                      event.target.value
                    )
                  }
                  placeholder="Ariana Petals Sticker"
                />
              </label>

              <label className="field-label">
                Category

                <select
                  value={form.category}
                  onChange={(event) =>
                    updateForm(
                      "category",
                      event.target.value
                    )
                  }
                >
                  {CATEGORIES.map((category) => (
                    <option
                      key={category}
                      value={category}
                    >
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field-label">
                Selling price

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(event) =>
                    updateForm(
                      "price",
                      event.target.value
                    )
                  }
                  placeholder="4.00"
                />
              </label>

              <label className="field-label">
                Current stock

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={(event) =>
                    updateForm(
                      "stock",
                      event.target.value
                    )
                  }
                  placeholder="25"
                />
              </label>
            </div>

            <div className="mockup-upload-section">
              <span className="upload-label">
                Mockup photo
              </span>

              <label className="mockup-upload-box">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Selected product mockup"
                  />
                ) : (
                  <div>
                    <span className="upload-icon">
                      💌
                    </span>

                    <strong>Upload mockup</strong>
                    <small>PNG, JPG or WEBP</small>
                  </div>
                )}

                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageChange}
                />
              </label>

              {imagePreview && (
                <button
                  type="button"
                  className="remove-image-button"
                  onClick={removeImage}
                >
                  Remove photo
                </button>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="cancel-button"
              onClick={resetForm}
            >
              Cancel
            </button>

            <button
              type="button"
              className="save-button"
              onClick={saveProduct}
            >
              {editingId
                ? "Save Changes"
                : "Save Product"}
            </button>
          </div>
        </section>
      )}

      <section className="catalog-tools">
        <label className="catalog-search">
          <span>🔍</span>

          <input
            type="search"
            value={searchText}
            onChange={(event) =>
              setSearchText(event.target.value)
            }
            placeholder="Search products..."
          />
        </label>

        <label className="archive-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) =>
              setShowArchived(
                event.target.checked
              )
            }
          />

          Show archived products
        </label>
      </section>

      {displayedProducts.length === 0 ? (
        <section className="catalog-empty">
          <span>🩰</span>
          <h2>No products found</h2>
          <p>
            Add a product or try another search.
          </p>
        </section>
      ) : (
        <section className="product-grid">
          {displayedProducts.map((product) => (
            <article
              className={`product-card ${
                product.active === false
                  ? "archived-product"
                  : ""
              }`}
              key={product.id}
            >
              <div className="product-image-box">
                {product.image ? (
                  <img
                    src={getImageUrl(product.image)}
                    alt={`${product.name} mockup`}
                  />
                ) : (
                  <div className="no-product-image">
                    <span>💌</span>
                    <small>No mockup</small>
                  </div>
                )}

                {product.active === false && (
                  <span className="archived-badge">
                    Archived
                  </span>
                )}
              </div>

              <div className="product-card-content">
                <span className="product-category">
                  {product.category}
                </span>

                <h2>{product.name}</h2>

                <strong className="product-price">
                  $
                  {Number(product.price).toFixed(2)}
                </strong>

                <div className="product-insights">
                  <div>
                    <span>Stock</span>
                    <strong>{product.stock}</strong>
                  </div>

                  <div>
                    <span>Sold</span>
                    <strong>
                      {product.unitsSold}
                    </strong>
                  </div>

                  <div>
                    <span>Revenue</span>
                    <strong>
                      $
                      {product.salesRevenue.toFixed(
                        2
                      )}
                    </strong>
                  </div>

                  <div>
                    <span>Last sold</span>
                    <strong>
                      {formatLastSold(
                        product.lastSoldAt
                      )}
                    </strong>
                  </div>
                </div>

                {product.isLowStock && (
                  <div className="low-stock-warning">
                    ⚠️ Low stock — {product.stock} left
                  </div>
                )}

                <div className="product-card-actions">
                  <button
                    type="button"
                    className="restock-product-button"
                    onClick={() =>
                      restockProduct(product)
                    }
                  >
                    📦 Restock
                  </button>

                  <button
                    type="button"
                    className="edit-product-button"
                    onClick={() =>
                      startEditingProduct(product)
                    }
                  >
                    ✏️ Edit
                  </button>

                  <button
                    type="button"
                    className="archive-product-button"
                    onClick={() =>
                      toggleStatus(product)
                    }
                  >
                    {product.active === false
                      ? "♻️ Restore"
                      : "📦 Archive"}
                  </button>

                  <button
                    type="button"
                    className="delete-product-button"
                    onClick={() =>
                      removeProduct(product)
                    }
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}

      <section
        ref={restockRef}
        className="restock-section"
      >
        <div className="panel-heading">
          <div>
            <p className="section-eyebrow">
              📦 Inventory
            </p>

            <h2>Restock Needed</h2>
          </div>

          <strong>
            {lowStockProducts.length}
          </strong>
        </div>

        {lowStockProducts.length === 0 ? (
          <div className="dashboard-empty">
            <span>🌷</span>
            <p>
              Everything is currently stocked!
            </p>
          </div>
        ) : (
          <div className="restock-list">
            {lowStockProducts.map((product) => (
              <div
                className="restock-row"
                key={product.id}
              >
                <div className="restock-image">
                  {product.image ? (
                    <img
                      src={getImageUrl(
                        product.image
                      )}
                      alt={product.name}
                    />
                  ) : (
                    <span>🩰</span>
                  )}
                </div>

                <div className="restock-info">
                  <strong>{product.name}</strong>

                  <span>
                    {product.stock} left in stock
                  </span>
                </div>

                <button
                  type="button"
                  className="restock-product-button"
                  onClick={() =>
                    restockProduct(product)
                  }
                >
                  📦 Restock
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default ProductCatalog;