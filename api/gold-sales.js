// 💰 Gold Sales Admin System API
import { getPendingGoldSales, updateGoldSaleStatus, createGoldSale } from '../database.js';

export default async function handler(req, res) {
  const { method } = req;
  
  try {
    if (method === 'GET') {
      // Get pending gold sales for admin dashboard
      console.log('📊 Fetching pending gold sales for admin...');
      const pendingSales = await getPendingGoldSales();
      
      return res.status(200).json({ 
        success: true,
        sales: pendingSales,
        count: pendingSales.length,
        message: `Found ${pendingSales.length} pending gold sales`
      });
      
    } else if (method === 'POST') {
      const { action, saleId, status, adminResponse, sellerAddress, goldAmount, solPrice, transactionSignature } = req.body;
      
      if (action === 'create') {
        // User creates gold sale request
        if (!sellerAddress || !goldAmount || !solPrice) {
          return res.status(400).json({ 
            error: 'Missing required fields: sellerAddress, goldAmount, solPrice' 
          });
        }
        
        console.log(`💰 Creating gold sale request: ${goldAmount} gold for ${solPrice} SOL`);
        const saleResult = await createGoldSale(sellerAddress, goldAmount, solPrice);
        
        if (saleResult) {
          return res.status(200).json({ 
            success: true,
            saleId: saleResult.id,
            createdAt: saleResult.created_at,
            message: 'Gold sale request created successfully. Waiting for admin approval.'
          });
        } else {
          return res.status(500).json({ 
            error: 'Failed to create gold sale request' 
          });
        }
        
      } else if (action === 'update') {
        // Admin approves/cancels gold sale
        if (!saleId || !status) {
          return res.status(400).json({ 
            error: 'Missing required fields: saleId, status' 
          });
        }
        
        if (!['approved', 'cancelled'].includes(status)) {
          return res.status(400).json({ 
            error: 'Status must be either "approved" or "cancelled"' 
          });
        }
        
        console.log(`🔧 Admin updating sale ${saleId} to ${status}`);
        const updatedSale = await updateGoldSaleStatus(saleId, status, adminResponse, transactionSignature);
        
        if (updatedSale) {
          return res.status(200).json({ 
            success: true,
            sale: updatedSale, 
            message: `Sale ${status} successfully`
          });
        } else {
          return res.status(500).json({ 
            error: 'Failed to update sale status' 
          });
        }
        
      } else {
        return res.status(400).json({ 
          error: 'Invalid action. Use "create" or "update"' 
        });
      }
    }
    
    res.status(405).json({ error: 'Method not allowed. Use GET or POST.' });
    
  } catch (error) {
    console.error('❌ Gold sales API error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}