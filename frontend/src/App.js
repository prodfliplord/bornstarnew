import React, { useState, useEffect } from 'react';
import './App.css';
import { Phone, Package, User, Clock, CheckCircle, XCircle, AlertCircle, Truck, ArrowRight, MapPin, CreditCard, Trash2, RefreshCw, StickyNote, Save, Edit3 } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

function App() {
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [stats, setStats] = useState({});
  const [editingNote, setEditingNote] = useState(null);
  const [noteText, setNoteText] = useState('');
  const [deletingOrder, setDeletingOrder] = useState(null);

  const statusConfig = {
    new: { label: 'New', color: 'blue', icon: Clock },
    confirmed: { label: 'Confirmed', color: 'green', icon: CheckCircle },
    cancelled: { label: 'Cancelled', color: 'red', icon: XCircle },
    not_picked: { label: 'Not Picked', color: 'orange', icon: AlertCircle },
    dispatched: { label: 'Dispatched', color: 'purple', icon: Truck },
    delivered: { label: 'Delivered', color: 'emerald', icon: CheckCircle },
    rto: { label: 'RTO', color: 'gray', icon: ArrowRight }
  };

  const tabs = [
    { id: 'all', label: 'All Orders', color: 'slate' },
    { id: 'new', label: 'New', color: 'blue' },
    { id: 'confirmed', label: 'Confirmed', color: 'green' },
    { id: 'cancelled', label: 'Cancelled', color: 'red' },
    { id: 'not_picked', label: 'Not Picked', color: 'orange' },
    { id: 'dispatched', label: 'Dispatched', color: 'purple' },
    { id: 'delivered', label: 'Delivered', color: 'emerald' },
    { id: 'rto', label: 'RTO', color: 'gray' }
  ];

  useEffect(() => {
    // clearDemoData(); // Commented out - only clear manually
    fetchOrders();
    fetchStats();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, activeTab]);

  const clearDemoData = async () => {
    try {
      await fetch(`${API_URL}/api/orders/demo/clear`, { method: 'DELETE' });
      console.log('Demo data cleared');
    } catch (error) {
      console.error('Error clearing demo data:', error);
    }
  };

  const fetchOrders = async () => {
    try {
      const response = await fetch(`${API_URL}/api/orders`);
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders);
      } else {
        console.error('Failed to fetch orders');
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${API_URL}/api/orders/stats`);
      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const syncOrders = async () => {
    setSyncing(true);
    try {
      const response = await fetch(`${API_URL}/api/orders/sync`, { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        console.log('Sync result:', data);
        await fetchOrders();
        await fetchStats();
      }
    } catch (error) {
      console.error('Error syncing orders:', error);
    } finally {
      setSyncing(false);
    }
  };

  const filterOrders = () => {
    if (activeTab === 'all') {
      setFilteredOrders(orders);
    } else {
      setFilteredOrders(orders.filter(order => order.local_status === activeTab));
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: orderId,
          status: newStatus,
          updated_at: new Date().toISOString()
        }),
      });

      if (response.ok) {
        await fetchOrders();
        await fetchStats();
      } else {
        console.error('Failed to update order status');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const deleteOrder = async (orderId) => {
    if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
      return;
    }

    setDeletingOrder(orderId);
    try {
      const response = await fetch(`${API_URL}/api/orders/${orderId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchOrders();
        await fetchStats();
      } else {
        console.error('Failed to delete order');
        alert('Failed to delete order. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting order:', error);
      alert('Error deleting order. Please try again.');
    } finally {
      setDeletingOrder(null);
    }
  };

  const updateOrderNote = async (orderId, note) => {
    try {
      const response = await fetch(`${API_URL}/api/orders/${orderId}/note`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          order_id: orderId,
          note: note
        }),
      });

      if (response.ok) {
        await fetchOrders();
        setEditingNote(null);
        setNoteText('');
      } else {
        console.error('Failed to update order note');
      }
    } catch (error) {
      console.error('Error updating order note:', error);
    }
  };

  const handlePhoneCall = (phoneNumber) => {
    if (phoneNumber) {
      window.location.href = `tel:${phoneNumber}`;
    }
  };

  const formatPrice = (price, currency = 'INR') => {
    return `${currency} ${parseFloat(price).toLocaleString()}`;
  };

  const getStatusCount = (status) => {
    if (status === 'all') {
      return orders.length;
    }
    return stats[status] || 0;
  };

  const formatAddress = (address) => {
    if (!address) return 'Address not available';
    const parts = [
      address.full_address,
      address.city,
      address.province,
      address.zip,
      address.country
    ].filter(Boolean);
    return parts.join(', ');
  };

  const getPaymentMethodBadge = (method) => {
    const isCOD = method && method.toUpperCase().includes('COD');
    return (
      <div className={`payment-badge ${isCOD ? 'payment-cod' : 'payment-prepaid'}`}>
        <CreditCard className="w-3 h-3" />
        <span>{isCOD ? 'COD' : 'Prepaid'}</span>
      </div>
    );
  };

  const startEditingNote = (orderId, currentNote) => {
    setEditingNote(orderId);
    setNoteText(currentNote || '');
  };

  const saveNote = (orderId) => {
    updateOrderNote(orderId, noteText);
  };

  const cancelEditingNote = () => {
    setEditingNote(null);
    setNoteText('');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="glass-card p-8 text-center">
          <div className="loading-spinner"></div>
          <p className="text-white mt-4">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Package className="w-8 h-8 text-blue-400" />
              <h1 className="text-xl font-bold text-white">Bornstar Orders</h1>
              
              {/* Sync Orders Button */}
              <button
                onClick={syncOrders}
                disabled={syncing}
                className="sync-button"
                title="Sync Orders"
              >
                <RefreshCw className={`w-5 h-5 ${syncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{syncing ? 'Syncing...' : 'Sync Orders'}</span>
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-300">
                Total Orders: <span className="font-semibold text-white">{orders.length}</span>
              </div>
              <button
                onClick={() => {
                  clearDemoData();
                  fetchOrders();
                  fetchStats();
                }}
                className="text-gray-400 hover:text-white transition-colors"
                title="Refresh Orders"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="sticky top-16 z-40 glass-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1 py-4 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`nav-tab ${activeTab === tab.id ? 'nav-tab-active' : ''} ${tab.color}`}
              >
                <span className="font-medium">{tab.label}</span>
                <span className="tab-badge">
                  {getStatusCount(tab.id)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              {orders.length === 0 ? 'Waiting for first order' : 'No orders found'}
            </h3>
            <p className="text-gray-400">
              {orders.length === 0 
                ? 'Your Shopify webhook is connected! New orders will appear here automatically.'
                : activeTab === 'all' ? 'No orders available.' : `No ${activeTab} orders found.`
              }
            </p>
            {orders.length === 0 && (
              <div className="mt-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg max-w-md mx-auto">
                <p className="text-blue-300 text-sm">
                  📢 Webhook URL: <br />
                  <code className="text-xs bg-black/30 px-2 py-1 rounded">
                    {window.location.origin}/api/webhook/shopify
                  </code>
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredOrders.map((order) => {
              const StatusIcon = statusConfig[order.local_status]?.icon || Clock;
              const statusInfo = statusConfig[order.local_status];
              const isEditingThis = editingNote === order.order_id;
              const isDeletingThis = deletingOrder === order.order_id;
              
              return (
                <div key={order.id} className="order-card">
                  {/* Order Header with Delete Button */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Package className="w-5 h-5 text-blue-400" />
                      <span className="font-semibold text-white">{order.order_number}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`status-badge status-${statusInfo?.color || 'gray'}`}>
                        <StatusIcon className="w-4 h-4" />
                        <span>{statusInfo?.label || 'Unknown'}</span>
                      </div>
                      <button
                        onClick={() => deleteOrder(order.order_id)}
                        disabled={isDeletingThis}
                        className="delete-button"
                        title="Delete Order"
                      >
                        <Trash2 className={`w-4 h-4 ${isDeletingThis ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center space-x-3">
                      <User className="w-5 h-5 text-gray-400" />
                      <span className="text-white font-medium">{order.customer_name}</span>
                    </div>
                    
                    {order.phone && (
                      <div className="flex items-center space-x-3">
                        <Phone className="w-5 h-5 text-green-400" />
                        <button
                          onClick={() => handlePhoneCall(order.phone)}
                          className="phone-button"
                        >
                          {order.phone}
                        </button>
                      </div>
                    )}

                    {/* Payment Method */}
                    <div className="flex items-center space-x-3">
                      {getPaymentMethodBadge(order.payment_method)}
                    </div>
                  </div>

                  {/* Customer Address */}
                  <div className="mb-6">
                    <div className="flex items-start space-x-3">
                      <MapPin className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                      <div>
                        <p className="text-sm text-gray-300 leading-relaxed">
                          {formatAddress(order.shipping_address)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Products */}
                  <div className="space-y-2 mb-6">
                    {order.products.slice(0, 2).map((product, index) => (
                      <div key={index} className="product-item">
                        <div className="flex items-center space-x-3">
                          <div className="product-image-placeholder">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-medium text-sm">{product.title}</p>
                            {product.variant_title && (
                              <p className="text-gray-400 text-xs">Size: {product.variant_title}</p>
                            )}
                            <p className="text-gray-400 text-xs">Qty: {product.quantity}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-green-400 text-sm">{formatPrice(product.price)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {order.products.length > 2 && (
                      <p className="text-gray-400 text-xs">+{order.products.length - 2} more items</p>
                    )}
                  </div>

                  {/* Order Total */}
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-gray-400">Total:</span>
                    <span className="text-green-400 font-bold">
                      {formatPrice(order.total_price, order.currency)}
                    </span>
                  </div>

                  {/* Notes Section */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <StickyNote className="w-4 h-4 text-yellow-400" />
                        <span className="text-sm text-gray-300">Notes</span>
                      </div>
                      {!isEditingThis && (
                        <button
                          onClick={() => startEditingNote(order.order_id, order.notes)}
                          className="text-gray-400 hover:text-yellow-400 transition-colors"
                          title="Edit Note"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    {isEditingThis ? (
                      <div className="space-y-2">
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Add a note for this order..."
                          className="note-textarea"
                          rows="3"
                        />
                        <div className="flex space-x-2">
                          <button
                            onClick={() => saveNote(order.order_id)}
                            className="note-save-button"
                          >
                            <Save className="w-3 h-3" />
                            Save
                          </button>
                          <button
                            onClick={cancelEditingNote}
                            className="note-cancel-button"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="note-display">
                        {order.notes ? (
                          <p className="text-sm text-gray-300">{order.notes}</p>
                        ) : (
                          <p className="text-sm text-gray-500 italic">No notes added</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Status Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    {order.local_status === 'new' && (
                      <>
                        <button
                          onClick={() => updateOrderStatus(order.order_id, 'confirmed')}
                          className="status-action-button bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Confirm
                        </button>
                        <button
                          onClick={() => updateOrderStatus(order.order_id, 'cancelled')}
                          className="status-action-button bg-red-600 hover:bg-red-700"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancel
                        </button>
                      </>
                    )}
                    
                    {order.local_status === 'confirmed' && (
                      <>
                        <button
                          onClick={() => updateOrderStatus(order.order_id, 'dispatched')}
                          className="status-action-button bg-purple-600 hover:bg-purple-700"
                        >
                          <Truck className="w-4 h-4" />
                          Dispatch
                        </button>
                        <button
                          onClick={() => updateOrderStatus(order.order_id, 'not_picked')}
                          className="status-action-button bg-orange-600 hover:bg-orange-700"
                        >
                          <AlertCircle className="w-4 h-4" />
                          Not Picked
                        </button>
                      </>
                    )}

                    {order.local_status === 'cancelled' && (
                      <>
                        <button
                          onClick={() => updateOrderStatus(order.order_id, 'confirmed')}
                          className="status-action-button bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Re-Confirm
                        </button>
                        <div className="col-span-1 text-center py-2 text-red-400 text-sm">
                          Order Cancelled
                        </div>
                      </>
                    )}
                    
                    {order.local_status === 'dispatched' && (
                      <>
                        <button
                          onClick={() => updateOrderStatus(order.order_id, 'delivered')}
                          className="status-action-button bg-emerald-600 hover:bg-emerald-700"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Delivered
                        </button>
                        <button
                          onClick={() => updateOrderStatus(order.order_id, 'rto')}
                          className="status-action-button bg-gray-600 hover:bg-gray-700"
                        >
                          <ArrowRight className="w-4 h-4" />
                          RTO
                        </button>
                      </>
                    )}
                    
                    {order.local_status === 'not_picked' && (
                      <>
                        <button
                          onClick={() => updateOrderStatus(order.order_id, 'confirmed')}
                          className="status-action-button bg-green-600 hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Re-Confirm
                        </button>
                        <button
                          onClick={() => updateOrderStatus(order.order_id, 'cancelled')}
                          className="status-action-button bg-red-600 hover:bg-red-700"
                        >
                          <XCircle className="w-4 h-4" />
                          Cancel
                        </button>
                      </>
                    )}
                    
                    {(order.local_status === 'delivered' || order.local_status === 'rto') && (
                      <div className="col-span-2 text-center py-2 text-gray-400 text-sm">
                        Order {statusInfo?.label}
                      </div>
                    )}
                  </div>

                  {/* Order Date */}
                  <div className="mt-4 pt-4 border-t border-gray-700/50">
                    <p className="text-gray-400 text-xs">
                      Created: {new Date(order.created_at).toLocaleDateString('en-IN')} {new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;