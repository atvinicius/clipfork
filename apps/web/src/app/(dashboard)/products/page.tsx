"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ProductsPage() {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ name: "", sourceUrl: "" });
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    price: "",
  });

  const productsQuery = trpc.product.list.useQuery({ limit: 50 });

  const selectedProduct = productsQuery.data?.products.find(
    (p) => p.id === selectedProductId
  );

  const createProductMutation = trpc.product.create.useMutation({
    onSuccess: () => {
      setShowAddDialog(false);
      setAddForm({ name: "", sourceUrl: "" });
      productsQuery.refetch();
    },
  });

  const updateProductMutation = trpc.product.update.useMutation({
    onSuccess: () => {
      productsQuery.refetch();
    },
  });

  const deleteProductMutation = trpc.product.delete.useMutation({
    onSuccess: () => {
      setSelectedProductId(null);
      productsQuery.refetch();
    },
  });

  function openProductDetail(productId: string) {
    const product = productsQuery.data?.products.find((p) => p.id === productId);
    if (product) {
      setEditForm({
        name: product.name,
        description: product.description ?? "",
        price: product.price ?? "",
      });
      setSelectedProductId(productId);
    }
  }

  function handleSaveEdit() {
    if (!selectedProductId) return;
    updateProductMutation.mutate({
      id: selectedProductId,
      name: editForm.name || undefined,
      description: editForm.description || undefined,
      price: editForm.price || undefined,
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Products</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your product catalog for video generation.
          </p>
        </div>
        <Button
          className="bg-[#7C3AED] hover:bg-[#7C3AED]/90"
          onClick={() => setShowAddDialog(true)}
        >
          + Add Product
        </Button>
      </div>

      {productsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-0">
                <div className="h-32 bg-muted" />
                <div className="space-y-2 p-4">
                  <div className="h-4 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (productsQuery.data?.products.length ?? 0) === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center p-12">
            <div className="mb-4 text-5xl">📦</div>
            <h3 className="text-lg font-medium">No products yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your first product to start creating videos.
            </p>
            <Button
              className="mt-4 bg-[#7C3AED] hover:bg-[#7C3AED]/90"
              onClick={() => setShowAddDialog(true)}
            >
              Add Product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {productsQuery.data?.products.map((product) => (
            <Card
              key={product.id}
              className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
              onClick={() => openProductDetail(product.id)}
            >
              <CardContent className="p-0">
                {/* Product image placeholder */}
                <div className="flex h-32 items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                  <span className="text-4xl">📦</span>
                </div>
                <div className="p-4">
                  <h3 className="truncate text-sm font-medium">
                    {product.name}
                  </h3>
                  {product.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {product.description}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    {product.price && (
                      <Badge variant="secondary">{product.price}</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {new Date(product.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {product.sourceUrl && (
                    <p className="mt-2 truncate text-xs text-muted-foreground">
                      {product.sourceUrl}
                    </p>
                  )}
                </div>
              </CardContent>
              <div className="border-t p-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-[#7C3AED] hover:bg-[#7C3AED]/5 hover:text-[#7C3AED]"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.location.href = `/create?productId=${product.id}`;
                  }}
                >
                  Create Video
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Product Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Product</DialogTitle>
            <DialogDescription>
              Add a product from a URL or manually enter the details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="product-name">Product Name</Label>
              <Input
                id="product-name"
                placeholder="e.g., Vitamin C Serum"
                value={addForm.name}
                onChange={(e) =>
                  setAddForm({ ...addForm, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="product-url">Product URL (optional)</Label>
              <Input
                id="product-url"
                placeholder="https://..."
                value={addForm.sourceUrl}
                onChange={(e) =>
                  setAddForm({ ...addForm, sourceUrl: e.target.value })
                }
              />
            </div>
            <Button
              className="w-full bg-[#7C3AED] hover:bg-[#7C3AED]/90"
              disabled={!addForm.name || createProductMutation.isPending}
              onClick={() => {
                createProductMutation.mutate({
                  name: addForm.name,
                  sourceUrl: addForm.sourceUrl || undefined,
                });
              }}
            >
              {createProductMutation.isPending ? "Adding..." : "Add Product"}
            </Button>
            {createProductMutation.error && (
              <p className="text-sm text-red-600">
                {createProductMutation.error.message}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Detail Dialog */}
      <Dialog
        open={!!selectedProductId}
        onOpenChange={(open) => {
          if (!open) setSelectedProductId(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Product Details</DialogTitle>
            <DialogDescription>
              Edit product information or create a video.
            </DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      description: e.target.value,
                    })
                  }
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="edit-price">Price</Label>
                <Input
                  id="edit-price"
                  value={editForm.price}
                  onChange={(e) =>
                    setEditForm({ ...editForm, price: e.target.value })
                  }
                  placeholder="$29.99"
                />
              </div>
              {selectedProduct.sourceUrl && (
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Source URL</p>
                  <a
                    href={selectedProduct.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-sm text-[#7C3AED] hover:underline"
                  >
                    {selectedProduct.sourceUrl}
                  </a>
                </div>
              )}
              <div className="flex gap-3">
                <Button
                  className="flex-1 bg-[#7C3AED] hover:bg-[#7C3AED]/90"
                  onClick={handleSaveEdit}
                  disabled={updateProductMutation.isPending}
                >
                  {updateProductMutation.isPending
                    ? "Saving..."
                    : "Save Changes"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (selectedProductId) {
                      deleteProductMutation.mutate({ id: selectedProductId });
                    }
                  }}
                  disabled={deleteProductMutation.isPending}
                >
                  Delete
                </Button>
              </div>
              <Button
                variant="outline"
                className="w-full text-[#7C3AED] hover:bg-[#7C3AED]/5"
                onClick={() => {
                  window.location.href = `/create?productId=${selectedProductId}`;
                }}
              >
                Create Video from this Product
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
