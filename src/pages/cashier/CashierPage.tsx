import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  Search,
  Plus,
  Minus,
  X,
  ShoppingCart,
  Clock,
  Pause,
  CreditCard,
  Banknote,
  Printer,
  FileDown,
  Trash2,
  RotateCcw,
  Package,
  ArrowLeft,
  ChevronRight,
} from 'lucide-react';
import {
  db,
  type Product,
  type Transaction,
  type PendingCart,
  type StoreProfile,
  type CartItem,
  getCategories,
  getTodayTransactions,
} from '@/lib/db';
import { formatRupiah, formatTime, formatDateTime } from '@/lib/format';
import { toast } from 'sonner';
import { LiquidButton } from '@/components/ui/liquid-glass-button';
import { jsPDF } from 'jspdf';

export default function CashierPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [categories, setCategories] = useState<string[]>([]);
  const [discount, setDiscount] = useState<{ type: 'fixed' | 'percentage'; value: number | '' }>({
    type: 'fixed',
    value: '',
  });
  const [showPayment, setShowPayment] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris'>('cash');
  const [cashReceived, setCashReceived] = useState<number | ''>('');
  const [customerName, setCustomerName] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [currentTransaction, setCurrentTransaction] = useState<Transaction | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showPending, setShowPending] = useState(false);
  const [showSnSelector, setShowSnSelector] = useState(false);
  const [snSelectorProduct, setSnSelectorProduct] = useState<Product | null>(null);
  const [tempSelectedSns, setTempSelectedSns] = useState<string[]>([]);
  const [pendingCarts, setPendingCarts] = useState<PendingCart[]>([]);
  const [todayTransactions, setTodayTransactions] = useState<Transaction[]>([]);
  const [storeProfile, setStoreProfile] = useState<StoreProfile | null>(null);

  // Mobile Dragging states
  const [isMobile, setIsMobile] = useState(false);
  const [cartHeight, setCartHeight] = useState(50); // in vh on mobile (default 50)
  const [isDragging, setIsDragging] = useState(false);
  const [dragHandleNode, setDragHandleNode] = useState<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);
  const cartHeightRef = useRef(cartHeight);

  // Keep cartHeightRef in sync with cartHeight state
  useEffect(() => {
    cartHeightRef.current = cartHeight;
  }, [cartHeight]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Programmatic touch events to bypass passive listener limits and call preventDefault()
  useEffect(() => {
    if (!dragHandleNode || !isMobile) return;

    const onTouchStart = (e: TouchEvent) => {
      isDraggingRef.current = true;
      setIsDragging(true);
      dragStartY.current = e.touches[0].clientY;
      dragStartHeight.current = cartHeightRef.current;

      // Synchronously remove transition styles on panels to prevent drag rendering lag
      const parent = dragHandleNode.parentElement;
      if (parent) {
        parent.style.transition = 'none';
        const leftPanel = parent.previousElementSibling as HTMLElement;
        if (leftPanel) {
          leftPanel.style.transition = 'none';
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current) return;
      // Prevent browser native pull-to-refresh, page scrolling, and bouncing
      if (e.cancelable) {
        e.preventDefault();
      }
      const currentY = e.touches[0].clientY;
      const deltaY = dragStartY.current - currentY;
      const deltaVh = (deltaY / window.innerHeight) * 100;
      let newHeight = dragStartHeight.current + deltaVh;
      if (newHeight < 18) newHeight = 18;
      if (newHeight > 95) newHeight = 95; // Allow dragging up to 95vh (mentok atas)
      setCartHeight(newHeight);
    };

    const onTouchEnd = () => {
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsDragging(false);

      // Re-enable transitions for smooth snap snapping back to presets
      const parent = dragHandleNode.parentElement;
      if (parent) {
        parent.style.transition = 'height 200ms ease-out';
        const leftPanel = parent.previousElementSibling as HTMLElement;
        if (leftPanel) {
          leftPanel.style.transition = 'height 200ms ease-out';
        }
      }

      setCartHeight((h) => {
        const presets = [18, 50, 92]; // Snapping presets (collapsed, half, expanded to 92vh)
        const nearest = presets.reduce((prev, curr) =>
          Math.abs(curr - h) < Math.abs(prev - h) ? curr : prev
        );
        return nearest;
      });
    };

    // iOS Safari fixes: touchstart MUST not be passive to enable e.preventDefault() in touchmove
    dragHandleNode.addEventListener('touchstart', onTouchStart, { passive: false });
    dragHandleNode.addEventListener('touchmove', onTouchMove, { passive: false });
    dragHandleNode.addEventListener('touchend', onTouchEnd, { passive: false });

    return () => {
      dragHandleNode.removeEventListener('touchstart', onTouchStart);
      dragHandleNode.removeEventListener('touchmove', onTouchMove);
      dragHandleNode.removeEventListener('touchend', onTouchEnd);
    };
  }, [dragHandleNode, isMobile]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isMobile) return;
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = cartHeight;

    // Disable transitions during drag
    if (dragHandleNode) {
      const parent = dragHandleNode.parentElement;
      if (parent) {
        parent.style.transition = 'none';
        const leftPanel = parent.previousElementSibling as HTMLElement;
        if (leftPanel) {
          leftPanel.style.transition = 'none';
        }
      }
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !isMobile) return;
      const deltaY = dragStartY.current - e.clientY;
      const deltaVh = (deltaY / window.innerHeight) * 100;
      let newHeight = dragStartHeight.current + deltaVh;
      if (newHeight < 18) newHeight = 18;
      if (newHeight > 95) newHeight = 95;
      setCartHeight(newHeight);
    };

    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);

        // Re-enable transitions
        if (dragHandleNode) {
          const parent = dragHandleNode.parentElement;
          if (parent) {
            parent.style.transition = 'height 200ms ease-out';
            const leftPanel = parent.previousElementSibling as HTMLElement;
            if (leftPanel) {
              leftPanel.style.transition = 'height 200ms ease-out';
            }
          }
        }

        setCartHeight((h) => {
          const presets = [18, 50, 92];
          const nearest = presets.reduce((prev, curr) =>
            Math.abs(curr - h) < Math.abs(prev - h) ? curr : prev
          );
          return nearest;
        });
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isMobile, cartHeight, dragHandleNode]);

  // ── Calculated Values ──────────────────────────────────────────────────────
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.sellPrice * item.quantity, 0),
    [cart]
  );
  const discountAmount = useMemo(
    () => (discount.type === 'percentage' ? (subtotal * Number(discount.value || 0)) / 100 : Number(discount.value || 0)),
    [discount, subtotal]
  );
  const total = useMemo(() => Math.max(0, subtotal - discountAmount), [subtotal, discountAmount]);
  const changeAmount = useMemo(() => Number(cashReceived || 0) - total, [cashReceived, total]);

  // ── Data Loaders ───────────────────────────────────────────────────────────
  const loadProducts = async () => {
    const all = await db.products.toArray();
    setProducts(all);
  };

  const loadCategories = async () => {
    const cats = await getCategories();
    setCategories(cats);
  };

  const loadPendingCarts = async () => {
    const pending = await db.pendingCarts.toArray();
    setPendingCarts(pending);
  };

  const loadTodayTransactions = async () => {
    const txs = await getTodayTransactions();
    setTodayTransactions(txs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
  };

  const loadStoreProfile = async () => {
    const profile = await db.storeProfile.get(1);
    if (profile) setStoreProfile(profile);
  };

  useEffect(() => {
    loadProducts();
    loadCategories();
    loadPendingCarts();
    loadTodayTransactions();
    loadStoreProfile();
  }, []);

  // ── Filtered Products ──────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      const matchCategory = selectedCategory === 'Semua' || p.category === selectedCategory;
      return matchSearch && matchCategory;
    });
  }, [products, search, selectedCategory]);

  // ── Cart Operations ────────────────────────────────────────────────────────
  // ── Cart Operations ────────────────────────────────────────────────────────
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.error('Stok habis!');
      return;
    }

    if (product.serialNumbers && product.serialNumbers.length > 0) {
      setSnSelectorProduct(product);
      setShowSnSelector(true);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          toast.error('Stok tidak mencukupi!');
          return prev;
        }
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          ...product,
          id: product.id!,
          quantity: 1,
        },
      ];
    });
  };

  const addToCartWithSn = (product: Product, sn: string) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        const selectedSns = existing.selectedSerialNumbers || [];
        if (selectedSns.includes(sn)) {
          toast.error(`Serial Number ${sn} sudah ada di keranjang!`);
          return prev;
        }
        if (selectedSns.length >= product.stock) {
          toast.error('Stok tidak mencukupi!');
          return prev;
        }
        return prev.map((i) =>
          i.id === product.id
            ? {
                ...i,
                quantity: selectedSns.length + 1,
                selectedSerialNumbers: [...selectedSns, sn],
              }
            : i
        );
      }
      return [
        ...prev,
        {
          ...product,
          id: product.id!,
          quantity: 1,
          selectedSerialNumbers: [sn],
        },
      ];
    });
  };

  const addMultipleSnsToCart = (product: Product, sns: string[]) => {
    if (sns.length === 0) return;
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        const currentSns = existing.selectedSerialNumbers || [];
        const newSns = [...currentSns];
        for (const sn of sns) {
          if (!newSns.includes(sn)) {
            newSns.push(sn);
          }
        }
        if (newSns.length > product.stock) {
          toast.error('Jumlah SN melebihi stok yang tersedia!');
          return prev;
        }
        return prev.map((i) =>
          i.id === product.id
            ? {
                ...i,
                quantity: newSns.length,
                selectedSerialNumbers: newSns,
              }
            : i
        );
      }
      return [
        ...prev,
        {
          ...product,
          id: product.id!,
          quantity: sns.length,
          selectedSerialNumbers: sns,
        },
      ];
    });
  };

  const removeSnFromCartItem = (productId: number, sn: string) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === productId);
      if (!existing) return prev;
      const currentSns = existing.selectedSerialNumbers || [];
      const nextSns = currentSns.filter((s) => s !== sn);
      if (nextSns.length === 0) {
        return prev.filter((i) => i.id !== productId);
      }
      return prev.map((i) =>
        i.id === productId
          ? {
              ...i,
              quantity: nextSns.length,
              selectedSerialNumbers: nextSns,
            }
          : i
      );
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((i) => i.id !== productId));
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart((prev) => {
      const item = prev.find((i) => i.id === productId);
      if (!item) return prev;

      if (item.selectedSerialNumbers && item.selectedSerialNumbers.length > 0) {
        if (delta === -1) {
          const nextSns = [...item.selectedSerialNumbers];
          nextSns.pop();
          if (nextSns.length === 0) {
            return prev.filter((i) => i.id !== productId);
          }
          return prev.map((i) =>
            i.id === productId
              ? { ...i, quantity: nextSns.length, selectedSerialNumbers: nextSns }
              : i
          );
        } else if (delta === 1) {
          setSnSelectorProduct(item);
          setShowSnSelector(true);
          return prev;
        }
      }

      const newQty = item.quantity + delta;
      if (newQty <= 0) return prev.filter((i) => i.id !== productId);
      if (newQty > item.stock) {
        toast.error('Stok tidak mencukupi!');
        return prev;
      }
      return prev.map((i) => (i.id === productId ? { ...i, quantity: newQty } : i));
    });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const query = search.trim();
      if (!query) return;

      const productBySn = products.find((p) =>
        p.serialNumbers?.some((sn) => sn.toLowerCase() === query.toLowerCase())
      );
      if (productBySn) {
        const matchedSn = productBySn.serialNumbers?.find(
          (sn) => sn.toLowerCase() === query.toLowerCase()
        ) || query;

        addToCartWithSn(productBySn, matchedSn);
        setSearch('');
        return;
      }

      const productBySku = products.find(
        (p) => p.sku.toLowerCase() === query.toLowerCase()
      );
      if (productBySku) {
        addToCart(productBySku);
        setSearch('');
        return;
      }

      toast.error('Produk atau Serial Number tidak ditemukan!');
    }
  };

  // ── Payment ────────────────────────────────────────────────────────────────
  const openPayment = () => {
    if (cart.length === 0) {
      toast.error('Keranjang kosong!');
      return;
    }
    setCashReceived('');
    setCustomerName('');
    setPaymentMethod('cash');
    setShowPayment(true);
  };

  const processPayment = async (method: 'cash' | 'qris') => {
    const transaction: Transaction = {
      items: cart.map((item) => ({
        productId: item.id!,
        name: item.name,
        quantity: item.quantity,
        price: item.sellPrice,
        buyPrice: item.buyPrice,
        serialNumbers: item.selectedSerialNumbers || [],
      })),
      subtotal,
      discount: discountAmount,
      discountType: discount.type,
      discountValue: Number(discount.value || 0),
      total,
      paymentMethod: method,
      cashReceived: method === 'cash' ? Number(cashReceived || 0) : undefined,
      change: method === 'cash' ? changeAmount : undefined,
      status: 'completed',
      timestamp: new Date(),
      customerName: customerName.trim() || undefined,
    };

    const id = await db.transactions.add(transaction);

    // Update stock & serial numbers
    for (const item of cart) {
      const product = await db.products.get(item.id!);
      if (product) {
        const updateData: Partial<Product> = {
          stock: product.stock - item.quantity,
        };
        if (product.serialNumbers && item.selectedSerialNumbers) {
          updateData.serialNumbers = product.serialNumbers.filter(
            (sn) => !item.selectedSerialNumbers!.includes(sn)
          );
        }
        await db.products.update(item.id!, updateData);
      }
    }

    setCurrentTransaction({ ...transaction, id });
    setShowPayment(false);
    setShowReceipt(true);
    toast.success('Transaksi berhasil!');
    loadProducts();
    loadTodayTransactions();
  };

  // ── Hold Transaction ───────────────────────────────────────────────────────
  const holdTransaction = async () => {
    if (cart.length === 0) {
      toast.error('Keranjang kosong!');
      return;
    }
    const label = prompt('Label pelanggan (opsional):') || `Pelanggan ${Date.now()}`;
    await db.pendingCarts.add({
      items: [...cart],
      label,
      timestamp: new Date(),
    });
    setCart([]);
    setDiscount({ type: 'fixed', value: 0 });
    toast.success(`Transaksi ditahan: ${label}`);
    loadPendingCarts();
  };

  // ── Resume Pending ─────────────────────────────────────────────────────────
  const resumePending = async (pending: PendingCart) => {
    if (cart.length > 0) {
      const confirmed = window.confirm(
        'Keranjang saat ini akan diganti. Lanjutkan?'
      );
      if (!confirmed) return;
    }
    setCart(pending.items);
    await db.pendingCarts.delete(pending.id!);
    setShowPending(false);
    toast.success(`Transaksi "${pending.label}" dilanjutkan`);
    loadPendingCarts();
  };

  const deletePending = async (id: number) => {
    await db.pendingCarts.delete(id);
    toast.success('Transaksi tertahan dihapus');
    loadPendingCarts();
  };

  // ── Void Transaction ───────────────────────────────────────────────────────
  const voidTransaction = async (tx: Transaction) => {
    if (tx.status === 'voided') return;
    const confirmed = window.confirm(
      'Batalkan transaksi ini? Stok akan dikembalikan.'
    );
    if (!confirmed) return;

    await db.transactions.update(tx.id!, { status: 'voided' });

    // Restore stock & serial numbers
    for (const item of tx.items) {
      const product = await db.products.get(item.productId);
      if (product) {
        const updateData: Partial<Product> = {
          stock: product.stock + item.quantity,
        };
        if (item.serialNumbers && item.serialNumbers.length > 0) {
          const currentSns = product.serialNumbers || [];
          const newSns = [...currentSns];
          for (const sn of item.serialNumbers) {
            if (!newSns.includes(sn)) {
              newSns.push(sn);
            }
          }
          updateData.serialNumbers = newSns;
        }
        await db.products.update(item.productId, updateData);
      }
    }

    toast.success('Transaksi dibatalkan, stok dikembalikan');
    loadTodayTransactions();
    loadProducts();
  };

  // ── Reset for new transaction ──────────────────────────────────────────────
  const resetTransaction = () => {
    setCart([]);
    setDiscount({ type: 'fixed', value: '' });
    setShowReceipt(false);
    setCurrentTransaction(null);
    setCashReceived('');
    setCustomerName('');
  };

  // ── Print Handler ──────────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  const exportReceiptPDF = () => {
    if (!currentTransaction) return;
    try {
      const paperSize = storeProfile?.receiptPaperSize || 'auto';
      const fontSizeSetting = storeProfile?.receiptFontSize || 'medium';
      
      // Determine PDF width and height dynamically
      const width = paperSize === '58mm' ? 58 : 80;
      
      // Base height: header details + payment details + thank you note
      const baseHeight = paperSize === '58mm' ? 85 : 95;
      const height = baseHeight + (currentTransaction.items.length * 95 / 10); // scale height based on number of items
      
      const doc = new jsPDF({
        unit: 'mm',
        format: [width, height],
      });

      // Set Font Sizes based on user settings
      let sizeStore = 13;
      let sizeBody = 9.5;
      let sizeSmall = 8;
      
      if (fontSizeSetting === 'small') {
        sizeStore = 11;
        sizeBody = 8;
        sizeSmall = 7;
      } else if (fontSizeSetting === 'large') {
        sizeStore = 16;
        sizeBody = 11.5;
        sizeSmall = 9.5;
      }
      
      // Use Helvetica (thick sans-serif) instead of Courier for much clearer print quality!
      doc.setFont('Helvetica', 'normal');

      let y = 8;
      
      // Store Header Logo
      const showLogo = storeProfile?.receiptShowLogo !== false;
      if (showLogo && storeProfile?.logo) {
        try {
          const logoSize = paperSize === '58mm' ? 12 : 16;
          const logoX = (width - logoSize) / 2;
          doc.addImage(storeProfile.logo, 'PNG', logoX, y, logoSize, logoSize);
          y += logoSize + 4;
        } catch (e) {
          console.error("Failed to add logo to PDF: ", e);
        }
      }

      // Store Name
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(sizeStore);
      doc.text(storeProfile?.storeName || 'KASIR GUE', width / 2, y, { align: 'center' });
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(sizeBody);
      
      const showSocial = storeProfile?.receiptShowSocial !== false;
      if (showSocial) {
        if (storeProfile?.address) {
          y += 5;
          doc.setFontSize(sizeSmall);
          doc.text(storeProfile.address, width / 2, y, { align: 'center', maxWidth: width - 10 });
        }
        
        if (storeProfile?.socialMedia) {
          y += 4.5;
          doc.setFontSize(sizeSmall);
          doc.text(storeProfile.socialMedia, width / 2, y, { align: 'center' });
        }
      }

      // Dividers
      const divLine = paperSize === '58mm' ? '---------------------------------------' : '---------------------------------------------------';
      const marginX = paperSize === '58mm' ? 4 : 6;
      const rightAlignX = width - marginX;
      
      y += 5;
      doc.setFontSize(sizeSmall);
      doc.text(divLine, width / 2, y, { align: 'center' });
      
      y += 4.5;
      doc.text(formatDateTime(new Date(currentTransaction.timestamp)), width / 2, y, { align: 'center' });

      if (currentTransaction.customerName) {
        y += 4;
        doc.setFont('Helvetica', 'bold');
        doc.text(`Pelanggan: ${currentTransaction.customerName}`, width / 2, y, { align: 'center', maxWidth: width - 10 });
        doc.setFont('Helvetica', 'normal');
      }

      y += 4;
      doc.setFontSize(sizeSmall);
      doc.text(divLine, width / 2, y, { align: 'center' });

      // Items
      doc.setFontSize(sizeBody);
      currentTransaction.items.forEach((item) => {
        y += 5;
        doc.setFont('Helvetica', 'bold');
        doc.text(item.name, marginX, y);

        if (item.serialNumbers && item.serialNumbers.length > 0) {
          y += 4;
          doc.setFont('Helvetica', 'oblique');
          doc.setFontSize(sizeSmall);
          doc.text(`SN: ${item.serialNumbers.join(', ')}`, marginX, y, { maxWidth: rightAlignX - marginX });
          doc.setFontSize(sizeBody);
        }

        y += 4.5;
        doc.setFont('Helvetica', 'normal');
        doc.text(`${item.quantity} x ${formatRupiah(item.price)}`, marginX, y);
        const itemTotal = formatRupiah(item.price * item.quantity);
        doc.text(itemTotal, rightAlignX, y, { align: 'right' });
      });

      y += 5;
      doc.setFontSize(sizeSmall);
      doc.text(divLine, width / 2, y, { align: 'center' });

      // Totals
      doc.setFontSize(sizeBody);
      y += 5;
      doc.text('Subtotal:', marginX, y);
      doc.text(formatRupiah(currentTransaction.subtotal), rightAlignX, y, { align: 'right' });

      if (currentTransaction.discount > 0) {
        y += 5;
        doc.text('Diskon:', marginX, y);
        doc.text(`-${formatRupiah(currentTransaction.discount)}`, rightAlignX, y, { align: 'right' });
      }

      y += 5.5;
      doc.setFont('Helvetica', 'bold');
      doc.text('TOTAL:', marginX, y);
      doc.text(formatRupiah(currentTransaction.total), rightAlignX, y, { align: 'right' });
      doc.setFont('Helvetica', 'normal');

      y += 5;
      doc.setFontSize(sizeSmall);
      doc.text(`Metode: ${currentTransaction.paymentMethod === 'cash' ? 'Tunai' : 'QRIS'}`, marginX, y);

      if (currentTransaction.paymentMethod === 'cash') {
        y += 4.5;
        doc.text('Diterima:', marginX, y);
        doc.text(formatRupiah(currentTransaction.cashReceived || 0), rightAlignX, y, { align: 'right' });

        y += 4.5;
        doc.text('Kembalian:', marginX, y);
        doc.text(formatRupiah(currentTransaction.change || 0), rightAlignX, y, { align: 'right' });
      }

      y += 5;
      doc.setFontSize(sizeSmall);
      doc.text(divLine, width / 2, y, { align: 'center' });

      y += 5;
      doc.setFontSize(sizeBody);
      doc.setFont('Helvetica', 'oblique');
      doc.text(storeProfile?.receiptFooterNote || 'Terima kasih atas kunjungan Anda!', width / 2, y, { align: 'center', maxWidth: width - 8 });

      doc.save(`struk-${currentTransaction.id || Date.now()}.pdf`);
      toast.success('PDF Struk berhasil disimpan!');
    } catch (err) {
      console.error(err);
      toast.error('Gagal mengekspor PDF');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="h-screen flex flex-col lg:flex-row bg-slate-950 text-white overflow-hidden">
      {/* ══════════════════════════════════════════════════════════════════════
          LEFT PANEL — Product Catalog
          ══════════════════════════════════════════════════════════════════════ */}
      <div 
        className="flex-[3] flex flex-col min-w-0 bg-slate-950 lg:h-full"
        style={{ 
          height: isMobile ? `${100 - cartHeight}vh` : undefined,
          transition: isDragging ? 'none' : 'height 200ms ease-out'
        }}
      >
        {/* ── Top Bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-slate-950/80 backdrop-blur-sm">
          <Link
            to="/"
            className="flex items-center justify-center w-9 h-9 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all duration-200 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-300" />
          </Link>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Kasir
          </h1>
          <div className="flex-1" />
          <button
            onClick={() => {
              loadPendingCarts();
              setShowPending(true);
            }}
            className="relative flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm hover:bg-amber-500/20 transition-all duration-200 cursor-pointer"
          >
            <Pause className="w-4 h-4" />
            <span className="hidden sm:inline">Tertahan</span>
            {pendingCarts.length > 0 && (
              <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-xs font-bold flex items-center justify-center animate-pulse">
                {pendingCarts.length}
              </span>
            )}
          </button>
        </div>

        {/* ── Search Bar ──────────────────────────────────────────────────── */}
        <div className="px-4 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Cari produk, SKU atau SN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-hex,#6366f1)]/40 focus:border-[var(--primary-hex,#6366f1)]/40 transition-all duration-200"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors cursor-pointer"
              >
                <X className="w-3 h-3 text-slate-400" />
              </button>
            )}
          </div>
        </div>

        {/* ── Category Pills ──────────────────────────────────────────────── */}
        <div className="px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {['Semua', ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer ${
                  selectedCategory === cat
                    ? 'text-white shadow-lg shadow-[var(--primary-hex,#6366f1)]/25'
                    : 'bg-white/5 text-slate-400 border border-white/10 hover:bg-white/10 hover:text-white'
                }`}
                style={
                  selectedCategory === cat
                    ? {
                        background: `linear-gradient(135deg, var(--primary-hex, #6366f1), var(--secondary-hex, #a78bfa))`,
                      }
                    : undefined
                }
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* ── Product Grid ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Package className="w-16 h-16 mb-4 opacity-30" />
              <p className="text-lg font-medium">Produk tidak ditemukan</p>
              <p className="text-sm mt-1">Coba ubah kata kunci atau kategori</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
                  className={`group relative bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden hover:border-[var(--primary-hex,#6366f1)]/50 transition-all duration-300 ${
                    product.stock <= 0 ? 'opacity-60' : ''
                  }`}
                >
                  {/* Product Image */}
                  <div className="relative h-[120px] bg-slate-800/50 overflow-hidden">
                    {product.photo ? (
                      <img
                        src={product.photo}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-10 h-10 text-slate-600" />
                      </div>
                    )}
                    {/* Out of Stock Overlay */}
                    {product.stock <= 0 && (
                      <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center backdrop-blur-sm">
                        <span className="text-red-400 font-bold text-sm px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20">
                          Stok Habis
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-3">
                    <h3 className="font-medium text-sm text-white truncate leading-tight">
                      {product.name}
                    </h3>
                    <p
                      className="font-bold text-sm mt-1"
                      style={{ color: 'var(--primary-hex, #6366f1)' }}
                    >
                      {formatRupiah(product.sellPrice)}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span
                        className={`text-xs ${
                          product.stock <= 5 && product.stock > 0
                            ? 'text-red-400'
                            : 'text-slate-500'
                        }`}
                      >
                        Stok: {product.stock}
                      </span>
                      <button
                        onClick={() => addToCart(product)}
                        disabled={product.stock <= 0}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-white transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed hover:scale-110 hover:shadow-lg active:scale-95"
                        style={{
                          background: `linear-gradient(135deg, var(--primary-hex, #6366f1), var(--secondary-hex, #a78bfa))`,
                          boxShadow:
                            product.stock > 0
                              ? '0 4px 12px var(--primary-hex, #6366f1)40'
                              : 'none',
                        }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          RIGHT PANEL — Shopping Cart
          ══════════════════════════════════════════════════════════════════════ */}
      <div 
        className="flex-[2] flex flex-col min-w-0 bg-slate-900 border-t lg:border-t-0 lg:border-l border-white/10 lg:h-full relative"
        style={{ 
          height: isMobile ? `${cartHeight}vh` : undefined,
          transition: isDragging ? 'none' : 'height 200ms ease-out'
        }}
      >
        {/* Mobile Drag Handle */}
        {isMobile && (
          <div 
            ref={setDragHandleNode}
            className="w-full py-4 flex items-center justify-center cursor-ns-resize hover:bg-white/5 active:bg-white/10 transition-colors select-none z-20"
            style={{ touchAction: 'none' }}
            onMouseDown={handleMouseDown}
          >
            <div className="w-14 h-1.5 bg-white/20 rounded-full hover:bg-white/40 transition-colors" />
          </div>
        )}
        {/* ── Cart Header ─────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <ShoppingCart className="w-5 h-5 text-slate-300" />
          <h2 className="text-lg font-bold text-white">Keranjang</h2>
          {cart.length > 0 && (
            <span
              className="px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
              style={{
                background: `linear-gradient(135deg, var(--primary-hex, #6366f1), var(--secondary-hex, #a78bfa))`,
              }}
            >
              {cart.reduce((sum, i) => sum + i.quantity, 0)} item
            </span>
          )}
        </div>

        {/* ── Cart Items ──────────────────────────────────────────────────── */}
        <div className={`flex-1 overflow-y-auto px-4 py-3 ${isMobile && cartHeight <= 25 ? 'hidden' : ''}`}>
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <div className="w-24 h-24 rounded-full bg-slate-800/50 flex items-center justify-center mb-4">
                <ShoppingCart className="w-10 h-10 opacity-30" />
              </div>
              <p className="text-base font-medium text-slate-400">Keranjang kosong</p>
              <p className="text-sm mt-1 text-slate-600">
                Tambahkan produk dari katalog
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-800/50 rounded-lg p-3 border border-white/5 hover:border-white/10 transition-all duration-200 animate-in fade-in slide-in-from-right-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-white truncate">
                        {item.name}
                      </h4>
                      {item.selectedSerialNumbers && item.selectedSerialNumbers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1 mb-1">
                          {item.selectedSerialNumbers.map((sn) => (
                            <span
                              key={sn}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/25 text-[10px] text-indigo-400 font-mono"
                            >
                              <span>{sn}</span>
                              <button
                                onClick={() => removeSnFromCartItem(item.id!, sn)}
                                className="text-[10px] hover:text-red-400 ml-0.5 transition-colors cursor-pointer"
                                title="Hapus SN"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-slate-500 mt-0.5">
                        {formatRupiah(item.sellPrice)} × {item.quantity}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p
                        className="font-bold text-sm"
                        style={{ color: 'var(--primary-hex, #6366f1)' }}
                      >
                        {formatRupiah(item.sellPrice * item.quantity)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() =>
                          item.quantity === 1
                            ? removeFromCart(item.id!)
                            : updateQuantity(item.id!, -1)
                        }
                        className="w-7 h-7 rounded-md bg-slate-700/50 flex items-center justify-center text-slate-300 hover:bg-red-500/20 hover:text-red-400 transition-all duration-200 cursor-pointer active:scale-90"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-white">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.id!, 1)}
                        className="w-7 h-7 rounded-md bg-slate-700/50 flex items-center justify-center text-slate-300 hover:bg-[var(--primary-hex,#6366f1)]/20 hover:text-[var(--primary-hex,#6366f1)] transition-all duration-200 cursor-pointer active:scale-90"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id!)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Discount Section ────────────────────────────────────────────── */}
        {cart.length > 0 && !(isMobile && cartHeight <= 25) && (
          <div className="px-4 py-3 border-t border-white/5">
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg overflow-hidden border border-white/10">
                <button
                  onClick={() =>
                    setDiscount((d) => ({ ...d, type: 'fixed', value: 0 }))
                  }
                  className={`px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                    discount.type === 'fixed'
                      ? 'bg-white/10 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  Rp
                </button>
                <button
                  onClick={() =>
                    setDiscount((d) => ({ ...d, type: 'percentage', value: 0 }))
                  }
                  className={`px-3 py-1.5 text-xs font-medium transition-all cursor-pointer ${
                    discount.type === 'percentage'
                      ? 'bg-white/10 text-white'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  %
                </button>
              </div>
              <input
                type="number"
                min={0}
                max={discount.type === 'percentage' ? 100 : subtotal}
                placeholder="Diskon"
                value={discount.value}
                onChange={(e) => {
                  const val = e.target.value;
                  setDiscount((d) => ({
                    ...d,
                    value: val === '' ? '' : parseFloat(val),
                  }));
                }}
                className="flex-1 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-white/10 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[var(--primary-hex,#6366f1)]/40 transition-all"
              />
            </div>
          </div>
        )}

        {/* ── Summary Section ─────────────────────────────────────────────── */}
        {cart.length > 0 && (
          <div className="px-4 py-3 border-t border-white/10 bg-slate-900/80">
            {!(isMobile && cartHeight <= 25) ? (
              <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Subtotal</span>
                  <span className="text-white">{formatRupiah(subtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Diskon</span>
                    <span className="text-red-400">
                      -{formatRupiah(discountAmount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-2 border-t border-white/5">
                  <span className="text-base font-medium text-slate-300">
                    Total
                  </span>
                  <span
                    className="text-2xl font-bold"
                    style={{ color: 'var(--primary-hex, #6366f1)' }}
                  >
                    {formatRupiah(total)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-center mb-2.5 px-1 select-none">
                <span className="text-xs text-slate-400">
                  Total ({cart.reduce((sum, i) => sum + i.quantity, 0)} item)
                </span>
                <span
                  className="text-base font-bold"
                  style={{ color: 'var(--primary-hex, #6366f1)' }}
                >
                  {formatRupiah(total)}
                </span>
              </div>
            )}

            {/* ── Action Buttons ─────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-2">
              <LiquidButton
                onClick={holdTransaction}
                variant="gold"
                size="default"
                className="w-full flex flex-col items-center justify-center gap-1 py-3.5 h-auto text-xs font-medium cursor-pointer"
              >
                <Pause className="w-4 h-4" />
                Tahan
              </LiquidButton>
              <LiquidButton
                onClick={() => {
                  loadTodayTransactions();
                  setShowHistory(true);
                }}
                variant="default"
                size="default"
                className="w-full flex flex-col items-center justify-center gap-1 py-3.5 h-auto text-xs font-medium cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                Riwayat
              </LiquidButton>
              <LiquidButton
                onClick={openPayment}
                variant="primary"
                size="default"
                className="w-full flex flex-col items-center justify-center gap-1 py-3.5 h-auto text-xs font-bold cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                Bayar
              </LiquidButton>
            </div>
          </div>
        )}

        {/* ── If cart is empty, show quick actions ────────────────────────── */}
        {cart.length === 0 && (
          <div className="px-4 py-3 border-t border-white/10">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  loadPendingCarts();
                  setShowPending(true);
                }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-all duration-200 cursor-pointer"
              >
                <Pause className="w-4 h-4" />
                Tertahan ({pendingCarts.length})
              </button>
              <button
                onClick={() => {
                  loadTodayTransactions();
                  setShowHistory(true);
                }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-700/30 border border-white/10 text-slate-300 text-sm font-medium hover:bg-slate-700/50 transition-all duration-200 cursor-pointer"
              >
                <Clock className="w-4 h-4" />
                Riwayat
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          PAYMENT MODAL
          ══════════════════════════════════════════════════════════════════════ */}
      {showPayment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className="w-full max-w-lg bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
            style={{
              boxShadow: '0 0 60px var(--primary-hex, #6366f1)15',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white">Pembayaran</h3>
              <button
                onClick={() => setShowPayment(false)}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Payment Method Tabs */}
            <div className="flex border-b border-white/10">
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all cursor-pointer ${
                  paymentMethod === 'cash'
                    ? 'text-white border-b-2'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                style={
                  paymentMethod === 'cash'
                    ? { borderColor: 'var(--primary-hex, #6366f1)' }
                    : undefined
                }
              >
                <Banknote className="w-4 h-4" />
                Tunai
              </button>
              <button
                onClick={() => setPaymentMethod('qris')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all cursor-pointer ${
                  paymentMethod === 'qris'
                    ? 'text-white border-b-2'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                style={
                  paymentMethod === 'qris'
                    ? { borderColor: 'var(--primary-hex, #6366f1)' }
                    : undefined
                }
              >
                <CreditCard className="w-4 h-4" />
                QRIS
              </button>
            </div>

            {/* Payment Content */}
            <div className="px-6 py-5">
              {/* Total Display */}
              <div className="text-center mb-6">
                <p className="text-sm text-slate-400 mb-1">Total Pembayaran</p>
                <p
                  className="text-3xl font-bold"
                  style={{ color: 'var(--primary-hex, #6366f1)' }}
                >
                  {formatRupiah(total)}
                </p>
              </div>

              {/* Nama Pelanggan Input */}
              <div className="mb-5">
                <label className="text-xs text-slate-400 mb-1.5 block font-medium">
                  Nama Pelanggan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Masukkan nama pelanggan..."
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800/50 border border-white/10 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary-hex,#6366f1)]/40 text-sm transition-all"
                />
              </div>

              {paymentMethod === 'cash' ? (
                <>
                  {/* Quick Amount Buttons */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[10000, 20000, 50000, 100000].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setCashReceived(amount)}
                        className={`py-2 rounded-lg text-xs font-medium border transition-all cursor-pointer active:scale-95 ${
                          cashReceived === amount
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {(amount / 1000).toFixed(0)}rb
                      </button>
                    ))}
                    {[150000, 200000, 500000].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setCashReceived(amount)}
                        className={`py-2 rounded-lg text-xs font-medium border transition-all cursor-pointer active:scale-95 ${
                          cashReceived === amount
                            ? 'bg-white/10 border-white/20 text-white'
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {(amount / 1000).toFixed(0)}rb
                      </button>
                    ))}
                    <button
                      onClick={() => setCashReceived(total)}
                      className="py-2 rounded-lg text-xs font-medium border transition-all cursor-pointer active:scale-95 bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                    >
                      Pas
                    </button>
                  </div>

                  {/* Custom Input */}
                  <div className="mb-4">
                    <label className="text-xs text-slate-500 mb-1.5 block">
                      Uang Diterima
                    </label>
                    <input
                      type="number"
                      value={cashReceived}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCashReceived(val === '' ? '' : parseFloat(val));
                      }}
                      placeholder="Masukkan nominal..."
                      className="w-full px-4 py-3 rounded-xl bg-slate-800/50 border border-white/10 text-white text-lg font-bold placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary-hex,#6366f1)]/40 transition-all"
                    />
                  </div>

                  {/* Change Display */}
                  {Number(cashReceived) > 0 && (
                    <div
                      className={`text-center py-3 rounded-xl mb-4 border ${
                        changeAmount >= 0
                          ? 'bg-emerald-500/10 border-emerald-500/20'
                          : 'bg-red-500/10 border-red-500/20'
                      }`}
                    >
                      <p className="text-xs text-slate-400 mb-0.5">Kembalian</p>
                      <p
                        className={`text-xl font-bold ${
                          changeAmount >= 0 ? 'text-emerald-400' : 'text-red-400'
                        }`}
                      >
                        {formatRupiah(Math.abs(changeAmount))}
                        {changeAmount < 0 && (
                          <span className="text-xs ml-1">(kurang)</span>
                        )}
                      </p>
                    </div>
                  )}

                  {/* Process Button */}
                  <LiquidButton
                    onClick={() => processPayment('cash')}
                    disabled={Number(cashReceived) < total}
                    variant={Number(cashReceived) >= total ? "success" : "default"}
                    size="lg"
                    className="w-full py-3.5 text-white font-bold text-base cursor-pointer"
                  >
                    Proses Pembayaran
                  </LiquidButton>
                </>
              ) : (
                /* QRIS Tab */
                <div className="text-center">
                  {storeProfile?.qrisImage ? (
                    <>
                      <div className="inline-block p-4 bg-white rounded-2xl mb-4 shadow-lg">
                        <img
                          src={storeProfile.qrisImage}
                          alt="QRIS"
                          className="w-48 h-48 object-contain"
                        />
                      </div>
                      <p className="text-sm text-slate-400 mb-6">
                        Scan kode QRIS di atas untuk melakukan pembayaran
                      </p>
                    </>
                  ) : (
                    <div className="py-8 text-slate-500">
                      <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">QRIS belum diatur</p>
                      <p className="text-xs mt-1">
                        Upload gambar QRIS di halaman Admin → Profil Toko
                      </p>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <LiquidButton
                      onClick={() => setShowPayment(false)}
                      variant="destructive"
                      size="default"
                      className="w-full py-2.5 font-medium text-sm cursor-pointer"
                    >
                      Batal
                    </LiquidButton>
                    <LiquidButton
                      onClick={() => processPayment('qris')}
                      disabled={!storeProfile?.qrisImage}
                      variant="success"
                      size="default"
                      className="w-full py-2.5 font-medium text-sm cursor-pointer"
                    >
                      Sudah Bayar
                    </LiquidButton>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          RECEIPT MODAL
          ══════════════════════════════════════════════════════════════════════ */}
      {showReceipt && currentTransaction && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            {/* Screen Receipt View (hidden on print) */}
            <div className="print:hidden">
              {/* Receipt Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <h3 className="text-lg font-bold text-white">Struk Pembayaran</h3>
                <button
                  onClick={resetTransaction}
                  className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Receipt Content (dark themed for screen) */}
              <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
                {/* Store Info */}
                <div className="text-center mb-4">
                  {storeProfile?.logo && (
                    <img
                      src={storeProfile.logo}
                      alt="Logo"
                      className="w-14 h-14 mx-auto mb-2 rounded-xl object-contain bg-white/10 p-1"
                    />
                  )}
                  <h4 className="text-base font-bold text-white">
                    {storeProfile?.storeName || 'Kasir Gue'}
                  </h4>
                  {storeProfile?.address && (
                    <p className="text-xs text-slate-500 mt-0.5">
                      {storeProfile.address}
                    </p>
                  )}
                  {storeProfile?.socialMedia && (
                    <p className="text-xs text-slate-500">
                      {storeProfile.socialMedia}
                    </p>
                  )}
                </div>

                <div className="border-t border-dashed border-white/10 my-3" />

                {/* Date */}
                <p className="text-xs text-slate-500 text-center mb-3">
                  {formatDateTime(new Date(currentTransaction.timestamp))}
                </p>

                {/* Customer Name */}
                {currentTransaction.customerName && (
                  <p className="text-xs text-white font-medium text-center -mt-2 mb-3">
                    Pelanggan: {currentTransaction.customerName}
                  </p>
                )}

                {/* Items */}
                <div className="space-y-2 mb-3">
                  {currentTransaction.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <div className="flex-1 min-w-0">
                        <span className="text-white truncate block">
                          {item.name}
                        </span>
                        {item.serialNumbers && item.serialNumbers.length > 0 && (
                          <span className="block text-[10px] text-indigo-400 font-mono italic mt-0.5">
                            SN: {item.serialNumbers.join(', ')}
                          </span>
                        )}
                        <span className="text-xs text-slate-500">
                          {item.quantity} × {formatRupiah(item.price)}
                        </span>
                      </div>
                      <span className="text-white font-medium flex-shrink-0 ml-3">
                        {formatRupiah(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-dashed border-white/10 my-3" />

                {/* Totals */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Subtotal</span>
                    <span className="text-white">
                      {formatRupiah(currentTransaction.subtotal)}
                    </span>
                  </div>
                  {currentTransaction.discount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Diskon</span>
                      <span className="text-red-400">
                        -{formatRupiah(currentTransaction.discount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold pt-1 border-t border-white/5">
                    <span className="text-white">Total</span>
                    <span style={{ color: 'var(--primary-hex, #6366f1)' }}>
                      {formatRupiah(currentTransaction.total)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-slate-400">Metode</span>
                    <span className="text-white capitalize">
                      {currentTransaction.paymentMethod === 'cash'
                        ? 'Tunai'
                        : 'QRIS'}
                    </span>
                  </div>
                  {currentTransaction.paymentMethod === 'cash' && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Diterima</span>
                        <span className="text-white">
                          {formatRupiah(currentTransaction.cashReceived || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Kembalian</span>
                        <span className="text-emerald-400">
                          {formatRupiah(currentTransaction.change || 0)}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="border-t border-dashed border-white/10 my-3" />

                <p className="text-center text-xs text-slate-500 italic">
                  Terima kasih atas kunjungan Anda!
                </p>
              </div>

              {/* Receipt Actions */}
              <div className="px-6 py-4 border-t border-white/10 grid grid-cols-3 gap-2">
                <LiquidButton
                  onClick={handlePrint}
                  variant="default"
                  size="default"
                  className="w-full flex flex-col items-center justify-center gap-1 py-2.5 h-auto text-xs font-medium cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Cetak Struk
                </LiquidButton>
                <LiquidButton
                  onClick={exportReceiptPDF}
                  variant="default"
                  size="default"
                  className="w-full flex flex-col items-center justify-center gap-1 py-2.5 h-auto text-xs font-medium cursor-pointer"
                >
                  <FileDown className="w-4 h-4" />
                  Simpan PDF
                </LiquidButton>
                <LiquidButton
                  onClick={resetTransaction}
                  variant="primary"
                  size="default"
                  className="w-full flex flex-col items-center justify-center gap-1 py-2.5 h-auto text-white text-xs font-bold cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  Baru
                </LiquidButton>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── Print-Only Receipt (rendered via React Portal directly under body for perfect clean printing) ──────────────── */}
      {showReceipt && currentTransaction && createPortal(
        <div 
          className="print-receipt hidden print:block bg-white text-black font-sans mx-auto"
          style={{
            width: '100%',
            maxWidth: storeProfile?.receiptPaperSize === '58mm' 
              ? '48mm' 
              : storeProfile?.receiptPaperSize === '80mm' 
                ? '76mm' 
                : '76mm',
            fontSize: storeProfile?.receiptFontSize === 'small' 
              ? '10px' 
              : storeProfile?.receiptFontSize === 'large' 
                ? '15px' 
                : '12px',
            lineHeight: '1.4',
            padding: '2mm'
          }}
        >
          {/* Store Header */}
          {(storeProfile?.receiptShowLogo !== false) && (
            <div className="text-center mb-3">
              {storeProfile?.logo && (
                <img
                  src={storeProfile.logo}
                  alt=""
                  className="w-12 h-12 mx-auto mb-1 object-contain"
                />
              )}
              <p className="font-bold text-[1.25em] leading-tight">
                {storeProfile?.storeName || 'Kasir Gue'}
              </p>
              {(storeProfile?.receiptShowSocial !== false) && (
                <div className="text-[0.9em] leading-snug mt-1">
                  {storeProfile?.address && (
                    <p>{storeProfile.address}</p>
                  )}
                  {storeProfile?.socialMedia && (
                    <p>{storeProfile.socialMedia}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {(storeProfile?.receiptShowLogo === false) && (
            <div className="text-center mb-3">
              <p className="font-bold text-[1.25em] leading-tight">
                {storeProfile?.storeName || 'Kasir Gue'}
              </p>
              {(storeProfile?.receiptShowSocial !== false) && (
                <div className="text-[0.9em] leading-snug mt-1">
                  {storeProfile?.address && (
                    <p>{storeProfile.address}</p>
                  )}
                  {storeProfile?.socialMedia && (
                    <p>{storeProfile.socialMedia}</p>
                  )}
                </div>
              )}
            </div>
          )}

          <p className="border-t border-dashed border-black my-2" />

          <p className="text-[0.9em] text-center">
            {formatDateTime(new Date(currentTransaction.timestamp))}
          </p>

          {/* Customer Name */}
          {currentTransaction.customerName && (
            <p className="text-[0.9em] text-center font-bold">
              Pelanggan: {currentTransaction.customerName}
            </p>
          )}

          <p className="border-t border-dashed border-black my-2" />

          {/* Items */}
          {currentTransaction.items.map((item, idx) => (
            <div key={idx} className="flex justify-between mb-1">
              <div>
                <span className="font-semibold">{item.name}</span>
                {item.serialNumbers && item.serialNumbers.length > 0 && (
                  <span className="block text-[0.8em] text-slate-800 font-mono italic">
                    SN: {item.serialNumbers.join(', ')}
                  </span>
                )}
                <br />
                <span className="text-[0.85em] text-slate-700">
                  {item.quantity} × {formatRupiah(item.price)}
                </span>
              </div>
              <span className="font-semibold">
                {formatRupiah(item.price * item.quantity)}
              </span>
            </div>
          ))}

          <p className="border-t border-dashed border-black my-2" />

          <div className="space-y-0.5">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatRupiah(currentTransaction.subtotal)}</span>
            </div>
            {currentTransaction.discount > 0 && (
              <div className="flex justify-between">
                <span>Diskon</span>
                <span>-{formatRupiah(currentTransaction.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-[1.15em] border-t border-dashed border-black pt-1 mt-1">
              <span>Total</span>
              <span>{formatRupiah(currentTransaction.total)}</span>
            </div>
            <div className="flex justify-between text-[0.95em]">
              <span>Metode</span>
              <span>
                {currentTransaction.paymentMethod === 'cash'
                  ? 'Tunai'
                  : 'QRIS'}
              </span>
            </div>
            {currentTransaction.paymentMethod === 'cash' && (
              <div className="text-[0.95em] space-y-0.5">
                <div className="flex justify-between">
                  <span>Diterima</span>
                  <span>
                    {formatRupiah(currentTransaction.cashReceived || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Kembalian</span>
                  <span>
                    {formatRupiah(currentTransaction.change || 0)}
                  </span>
                </div>
              </div>
            )}
          </div>

          <p className="border-t border-dashed border-black my-2" />

          <p className="text-center text-[0.9em] italic">
            {storeProfile?.receiptFooterNote || 'Terima kasih atas kunjungan Anda!'}
          </p>
        </div>,
        document.body
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          TRANSACTION HISTORY MODAL
          ══════════════════════════════════════════════════════════════════════ */}
      {showHistory && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-slate-300" />
                <h3 className="text-lg font-bold text-white">
                  Riwayat Transaksi Hari Ini
                </h3>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Transaction List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {todayTransactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Clock className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">Belum ada transaksi hari ini</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todayTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      onClick={() => {
                        setCurrentTransaction(tx);
                        setShowHistory(false);
                        setShowReceipt(true);
                      }}
                      className={`bg-slate-800/50 rounded-lg p-4 border border-white/5 hover:bg-slate-800/80 hover:border-[var(--primary-hex,#6366f1)]/40 transition-all duration-200 cursor-pointer group ${
                        tx.status === 'voided' ? 'opacity-60' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-slate-500">
                            {formatTime(new Date(tx.timestamp))}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              tx.status === 'completed'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-red-500/10 text-red-400 border border-red-500/20'
                            }`}
                          >
                            {tx.status === 'completed'
                              ? 'Selesai'
                              : 'Dibatalkan'}
                          </span>
                          <span
                            className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-white/5 border border-white/10 text-slate-400"
                          >
                            {tx.paymentMethod === 'cash' ? 'Tunai' : 'QRIS'}
                          </span>
                        </div>
                        {tx.customerName && (
                          <span className="text-xs font-bold text-[var(--primary-hex,#6366f1)] bg-[var(--primary-hex,#6366f1)]/10 px-2 py-0.5 rounded-md truncate max-w-[150px]">
                            {tx.customerName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p
                            className={`text-base font-bold ${
                              tx.status === 'voided'
                                ? 'line-through text-slate-500'
                                : 'group-hover:text-white'
                            }`}
                            style={
                              tx.status !== 'voided'
                                ? { color: 'var(--primary-hex, #6366f1)' }
                                : undefined
                            }
                          >
                            {formatRupiah(tx.total)}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {tx.items.length} produk ·{' '}
                            {tx.items.reduce((s, i) => s + i.quantity, 0)} item
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            Lihat Stuk →
                          </span>
                          {tx.status === 'completed' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                voidTransaction(tx);
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-all cursor-pointer active:scale-95"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Batalkan
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          PENDING TRANSACTIONS MODAL
          ══════════════════════════════════════════════════════════════════════ */}
      {showPending && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <Pause className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-bold text-white">
                  Transaksi Tertahan
                </h3>
                {pendingCarts.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {pendingCarts.length}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowPending(false)}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Pending List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {pendingCarts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                  <Pause className="w-12 h-12 mb-3 opacity-30" />
                  <p className="text-sm">Tidak ada transaksi tertahan</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingCarts.map((pending) => (
                    <div
                      key={pending.id}
                      className="bg-slate-800/50 rounded-lg p-4 border border-white/5 hover:border-amber-500/20 transition-all duration-200"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-medium text-white text-sm">
                            {pending.label}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {formatDateTime(new Date(pending.timestamp))}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-amber-400 font-bold">
                            {formatRupiah(
                              pending.items.reduce(
                                (s, i) => s + i.sellPrice * i.quantity,
                                0
                              )
                            )}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {pending.items.length} produk ·{' '}
                            {pending.items.reduce(
                              (s, i) => s + i.quantity,
                              0
                            )}{' '}
                            item
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => deletePending(pending.id!)}
                            className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all cursor-pointer active:scale-95"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => resumePending(pending)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all cursor-pointer active:scale-95 hover:shadow-lg"
                            style={{
                              background: `linear-gradient(135deg, var(--primary-hex, #6366f1), var(--secondary-hex, #a78bfa))`,
                            }}
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                            Lanjutkan
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SERIAL NUMBER SELECTOR MODAL
          ══════════════════════════════════════════════════════════════════════ */}
      {showSnSelector && snSelectorProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔑</span>
                <div className="text-left">
                  <h3 className="text-base font-bold text-white leading-tight">
                    Pilih Serial Number
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {snSelectorProduct.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowSnSelector(false);
                  setSnSelectorProduct(null);
                  setTempSelectedSns([]);
                }}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content / SN List */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {(() => {
                const cartItem = cart.find(i => i.id === snSelectorProduct.id);
                const selectedInCart = cartItem?.selectedSerialNumbers || [];
                const availableSns = (snSelectorProduct.serialNumbers || []).filter(
                  (sn) => !selectedInCart.includes(sn)
                );

                if (availableSns.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500 text-center">
                      <span className="text-3xl mb-3">⚠️</span>
                      <p className="text-sm font-medium">Stok SN Habis</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Semua Serial Number produk ini sudah dimasukkan ke keranjang belanja atau tidak tersedia lagi.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400 font-medium mb-3">
                      Pilih satu atau lebih Serial Number berikut:
                    </p>
                    <div className="grid grid-cols-1 gap-2 max-h-[40vh] overflow-y-auto pr-1">
                      {availableSns.map((sn) => {
                        const isChecked = tempSelectedSns.includes(sn);
                        return (
                          <label
                            key={sn}
                            className={`flex items-center justify-between p-3 rounded-lg border text-sm font-mono transition-all duration-200 cursor-pointer ${
                              isChecked
                                ? 'bg-[var(--primary-hex,#6366f1)]/10 border-[var(--primary-hex,#6366f1)] text-white font-bold'
                                : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10 hover:border-white/10'
                            }`}
                          >
                            <span>{sn}</span>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setTempSelectedSns((prev) =>
                                  prev.includes(sn)
                                    ? prev.filter((s) => s !== sn)
                                    : [...prev, sn]
                                );
                              }}
                              className="w-4 h-4 rounded border-white/10 bg-slate-800 text-indigo-500 focus:ring-indigo-500/50 cursor-pointer"
                            />
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-slate-950/30 flex items-center justify-between gap-3 flex-shrink-0">
              <span className="text-xs text-slate-400 font-medium pl-2">
                {tempSelectedSns.length} SN Terpilih
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowSnSelector(false);
                    setSnSelectorProduct(null);
                    setTempSelectedSns([]);
                  }}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-all text-xs font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  disabled={tempSelectedSns.length === 0}
                  onClick={() => {
                    addMultipleSnsToCart(snSelectorProduct, tempSelectedSns);
                    setShowSnSelector(false);
                    setSnSelectorProduct(null);
                    setTempSelectedSns([]);
                  }}
                  className="px-4 py-2 rounded-xl text-white font-bold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  style={{
                    background: tempSelectedSns.length > 0 
                      ? 'linear-gradient(135deg, var(--primary-hex, #6366f1), var(--secondary-hex, #a78bfa))'
                      : '#334155'
                  }}
                >
                  Tambahkan ({tempSelectedSns.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Print Styles (injected) ───────────────────────────────────────── */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .print\\:block,
          .print\\:block * {
            visibility: visible !important;
          }
          .print\\:block {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
          }
          .print\\:hidden {
            display: none !important;
          }
        }

        /* Custom scrollbar */
        .overflow-y-auto::-webkit-scrollbar {
          width: 4px;
        }
        .overflow-y-auto::-webkit-scrollbar-track {
          background: transparent;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .overflow-y-auto::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        /* Hide horizontal scrollbar on category pills */
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        /* Animate in */
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes zoomIn95 {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(8px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-in {
          animation: fadeIn 0.2s ease-out;
        }
        .fade-in {
          animation: fadeIn 0.2s ease-out;
        }
        .zoom-in-95 {
          animation: zoomIn95 0.2s ease-out;
        }
        .slide-in-from-right-2 {
          animation: slideInRight 0.2s ease-out;
        }
      `}</style>
    </div>
  );
}
