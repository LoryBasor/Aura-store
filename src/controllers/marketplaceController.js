// src/controllers/marketplaceController.js
const marketplaceService = require('../services/marketplaceService');
const { successResponse } = require('../utils/response');

/**
 * Contrôleur pour le marketplace public
 */
class MarketplaceController {
  /**
   * Page principale marketplace
   * GET /marketplace
   */
  async getHome(req, res, next) {
    try {
      const homeData = await marketplaceService.getMarketplaceHome();

      res.render('marketplace/home', {
        title: 'Marketplace - Aura',
        popularProducts: homeData.popularProducts || [],
        recentProducts: homeData.recentProducts || [],
        recommendedStores: homeData.recommendedStores || [],
        sponsoredStores: homeData.sponsoredStores || [],
        trendingCategories: homeData.trendingCategories || []
      });
    } catch (error) {
      console.error('Erreur marketplace home:', error);
      next(error);
    }
  }

  /**
   * Page liste produits
   * GET /marketplace/products
   */
  async getProducts(req, res, next) {
    try {
      const filters = {
        search: req.query.search,
        category: req.query.category,
        city: req.query.city,
        country: req.query.country,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : null,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : null,
        sort: req.query.sort || 'recent',
        limit: req.query.limit ? parseInt(req.query.limit) : 20,
        offset: req.query.offset ? parseInt(req.query.offset) : 0
      };

      const data = await marketplaceService.getProducts(filters);
      const categories = await marketplaceService.getCategories();
      const cities = await marketplaceService.getCities();
      const countries = await marketplaceService.getCountries();

      res.render('marketplace/products', {
        title: 'Produits - Marketplace Aura',
        products: data.products,
        total: data.total,
        filters,
        categories,
        cities,
        countries
      });
    } catch (error) {
      console.error('Erreur marketplace products:', error);
      next(error);
    }
  }

  /**
   * API pour récupérer les produits filtrés (pour AJAX)
   * GET /api/marketplace/products
   */
  async getProductsAPI(req, res, next) {
    try {
      const filters = {
        search: req.query.search,
        category: req.query.category,
        city: req.query.city,
        country: req.query.country,
        minPrice: req.query.minPrice ? parseFloat(req.query.minPrice) : null,
        maxPrice: req.query.maxPrice ? parseFloat(req.query.maxPrice) : null,
        sort: req.query.sort || 'recent',
        limit: req.query.limit ? parseInt(req.query.limit) : 20,
        offset: req.query.offset ? parseInt(req.query.offset) : 0
      };

      const data = await marketplaceService.getProducts(filters);
      return successResponse(res, data, 'Produits récupérés avec succès');
    } catch (error) {
      console.error('Erreur API marketplace products:', error);
      next(error);
    }
  }

  /**
   * Page liste boutiques
   * GET /marketplace/stores
   */
  async getStores(req, res, next) {
    try {
      const filters = {
        city: req.query.city,
        country: req.query.country,
        sort: req.query.sort || 'recent',
        limit: req.query.limit ? parseInt(req.query.limit) : 20,
        offset: req.query.offset ? parseInt(req.query.offset) : 0
      };

      const data = await marketplaceService.getStores(filters);
      const cities = await marketplaceService.getCities();
      const countries = await marketplaceService.getCountries();

      res.render('marketplace/stores', {
        title: 'Boutiques - Marketplace Aura',
        stores: data.stores,
        total: data.total,
        filters,
        cities,
        countries
      });
    } catch (error) {
      console.error('Erreur marketplace stores:', error);
      next(error);
    }
  }

  /**
   * API pour récupérer les boutiques filtrées (pour AJAX)
   * GET /api/marketplace/stores
   */
  async getStoresAPI(req, res, next) {
    try {
      const filters = {
        city: req.query.city,
        country: req.query.country,
        sort: req.query.sort || 'recent',
        limit: req.query.limit ? parseInt(req.query.limit) : 20,
        offset: req.query.offset ? parseInt(req.query.offset) : 0
      };

      const data = await marketplaceService.getStores(filters);
      return successResponse(res, data, 'Boutiques récupérées avec succès');
    } catch (error) {
      console.error('Erreur API marketplace stores:', error);
      next(error);
    }
  }

  /**
   * API pour récupérer les filtres disponibles
   * GET /api/marketplace/filters
   */
  async getFilters(req, res, next) {
    try {
      const [categories, cities, countries] = await Promise.all([
        marketplaceService.getCategories(),
        marketplaceService.getCities(),
        marketplaceService.getCountries()
      ]);

      return successResponse(res, {
        categories,
        cities,
        countries
      }, 'Filtres récupérés avec succès');
    } catch (error) {
      console.error('Erreur API marketplace filters:', error);
      next(error);
    }
  }
}

module.exports = new MarketplaceController();