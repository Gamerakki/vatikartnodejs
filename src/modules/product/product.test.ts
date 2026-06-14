import { ProductService } from './product.service';
import { productRepository } from './product.repository';
import { companyRepository } from '../company/company.repository';

jest.mock('./product.repository');
jest.mock('../company/company.repository');

describe('ProductService', () => {
  let productService: ProductService;

  beforeEach(() => {
    productService = new ProductService();
    jest.clearAllMocks();
  });

  describe('saveVariantOptions', () => {
    it('correctly maps sizes and colors to repository format', async () => {
      (companyRepository.fetchCompanyIDViaUserId as jest.Mock).mockResolvedValue(10);
      
      const req = {
        product_id: 99,
        sizes: [
          { label: 'M', sort_order: 1 },
          { label: 'L', sort_order: 2 }
        ],
        colors: [
          { label: 'Red', accent: '#ff0000', sort_order: 1 }
        ]
      };

      await productService.saveVariantOptions(1, req);

      expect(companyRepository.fetchCompanyIDViaUserId).toHaveBeenCalledWith(1);
      expect(productRepository.saveVariantOptions).toHaveBeenCalledWith(
        99,
        10,
        [
          { optionType: 'size', label: 'M', accent: null, sortOrder: 1, isSet: false, setQuantity: 1 },
          { optionType: 'size', label: 'L', accent: null, sortOrder: 2, isSet: false, setQuantity: 1 },
          { optionType: 'color', label: 'Red', accent: '#ff0000', sortOrder: 1, isSet: false, setQuantity: 1 }
        ]
      );
    });
  });
});
